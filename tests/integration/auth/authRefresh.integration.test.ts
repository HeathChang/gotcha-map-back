/**
 * C1 회귀 — POST /auth/refresh 는 client access(Authorization)의 클레임을 신뢰하지 않는다.
 *
 * 배경(C1): (구)decodeAccessForRefresh 가 jwt.decode(서명 미검증)로 Bearer 의 role/kind 를
 *   복사 → signAccessToken 이 그대로 서버서명 → adminAuth 가 수용 → 일반 유저가 자기계정을
 *   admin 으로 자가승격할 수 있었다. 수정: rotateRefresh 가 refresh_token 레코드의 user_id 로
 *   users 를 재조회해 신원(userId/email)을 재구성한다. 소비자 토큰은 role/kind 를 갖지 않는다.
 *
 * DB 만 모킹하고 signAccessToken(실제 jwt.sign)을 태워 발급 토큰의 클레임을 검증한다.
 * query 호출 순서: ① refresh_tokens SELECT ② users SELECT(신원).
 *
 * B1 회귀(iat/exp 박힌 access 를 Bearer 로 받아도 500 없이 회전)도 함께 유지한다.
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { query, withTransaction } from '../../../src/config/database';
import { refresh } from '../../../src/controllers/auth.controller';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as unknown as jest.Mock;

interface InvokeResult {
    jsonBody?: { data?: { accessToken?: string; refreshToken?: string } };
    nextErr?: { code?: string } | unknown;
    status?: number;
}

// asyncHandler 는 (req,res,next)=>void 이므로 res.json 또는 next 호출로 완료를 신호한다.
function invoke(req: Partial<Request>): Promise<InvokeResult> {
    return new Promise((resolve) => {
        let jsonBody: InvokeResult['jsonBody'];
        let status: number | undefined;
        const res = {
            status(code: number) {
                status = code;
                return this;
            },
            json(body: InvokeResult['jsonBody']) {
                jsonBody = body;
                resolve({ jsonBody, status });
            },
            cookie() {
                /* setRefreshCookie no-op */
            },
        } as unknown as Response;
        const next = (err?: unknown) => resolve({ nextErr: err, status });
        (refresh as unknown as (r: Request, s: Response, n: (e?: unknown) => void) => void)(
            req as Request,
            res,
            next,
        );
    });
}

const REFRESH_ROW = {
    token_id: 't1',
    user_id: 'u1',
    family_id: 'f1',
    parent_id: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    used_at: null,
    revoked_at: null,
};
const ACTIVE_USER = { user_id: 'u1', email: 'u1@test.com' };

// ① refresh_tokens SELECT → 유효 레코드, ② users SELECT(신원) → userRows.
function mockDbSequence(userRows: unknown[]): void {
    mockQuery.mockReset();
    mockQuery
        .mockResolvedValueOnce([REFRESH_ROW] as never)
        .mockResolvedValueOnce(userRows as never);
    mockWithTransaction.mockReset();
    mockWithTransaction.mockImplementation(
        async (cb: (c: { query: jest.Mock }) => Promise<unknown>) => {
            const connQuery = jest
                .fn()
                .mockResolvedValueOnce({ affectedRows: 1 })
                .mockResolvedValueOnce({});
            return cb({ query: connQuery });
        },
    );
}

function requestWith(headers: Record<string, string>): Request {
    return {
        headers,
        body: { refreshToken: 'r'.repeat(40) },
        get: () => undefined,
        ip: '127.0.0.1',
    } as unknown as Request;
}

describe('POST /auth/refresh — C1 신원 재구성 + B1 회귀', () => {
    it('신원 힌트(Authorization/body)가 없어도 refresh_token 레코드로 회전 성공', async () => {
        mockDbSequence([ACTIVE_USER]);
        const { jsonBody, nextErr, status } = await invoke(requestWith({}));

        expect(nextErr).toBeUndefined();
        expect(status).toBe(200);
        expect(jsonBody?.data?.accessToken).toBeTruthy();
        expect(jsonBody?.data?.refreshToken).toBeTruthy();
    });

    it('iat/exp 가 박힌 access 를 Bearer 로 받아도 500 없이 회전한다 (B1 회귀)', async () => {
        mockDbSequence([ACTIVE_USER]);
        const access = jwt.sign(
            { userId: 'u1', email: 'u1@test.com' },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' },
        );
        const { jsonBody, nextErr, status } = await invoke(
            requestWith({ authorization: `Bearer ${access}` }),
        );

        expect(nextErr).toBeUndefined();
        expect(status).toBe(200);
        expect(jsonBody?.data?.accessToken).toBeTruthy();
    });

    it('위조 Bearer(kind:admin,role:admin)를 보내도 발급 토큰은 소비자 토큰(role/kind 없음)', async () => {
        mockDbSequence([ACTIVE_USER]);
        // 서명은 무의미 — 서버는 이 토큰을 decode 조차 하지 않는다.
        const forged = jwt.sign(
            { userId: 'u1', email: 'u1@test.com', kind: 'admin', role: 'admin' },
            'attacker-secret',
            { expiresIn: '15m' },
        );
        const { jsonBody, status } = await invoke(
            requestWith({ authorization: `Bearer ${forged}` }),
        );

        expect(status).toBe(200);
        const decoded = jwt.decode(jsonBody?.data?.accessToken as string) as {
            userId?: string;
            kind?: string;
            role?: string;
        } | null;
        expect(decoded?.userId).toBe('u1');
        expect(decoded?.kind).toBeUndefined();
        expect(decoded?.role).toBeUndefined();
    });

    it('비활성/탈퇴 계정(users status≠1 → 0건)이면 INVALID_REFRESH_TOKEN 으로 거부', async () => {
        mockDbSequence([]); // 신원 조회 0건
        const { nextErr, jsonBody } = await invoke(requestWith({}));

        expect(jsonBody).toBeUndefined();
        expect((nextErr as { code?: string })?.code).toBe('INVALID_REFRESH_TOKEN');
    });
});
