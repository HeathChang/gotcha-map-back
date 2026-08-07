/**
 * B1 회귀 — POST /auth/refresh 의 Authorization(만료 access) 처리.
 *
 * 배경(B1):
 *  - 프론트가 refresh 시 Authorization 헤더도 body 신원도 안 보내 BE 가
 *    MISSING_IDENTITY_HINT(401) 로 거부 → access 만료(15m)마다 강제 로그아웃.
 *    → 프론트가 (만료됐을 수 있는) access 를 Authorization: Bearer 로 보내도록 수정.
 *  - 그러자 decodeAccessForRefresh 가 jwt.decode 의 전체 payload(iat/exp 포함)를 반환해
 *    rotateRefresh → signAccessToken 의 jwt.sign({expiresIn}) 이
 *    "payload already has an exp property" 로 500 을 던짐.
 *    → decodeAccessForRefresh 가 도메인 신원 필드만 추려 깨끗한 payload 를 반환하도록 수정.
 *
 * 이 테스트는 DB 만 모킹하고 signAccessToken(실제 jwt.sign)을 태워 위 500 을 방어한다.
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

beforeEach(() => {
    jest.clearAllMocks();
    // rotateRefresh 의 SELECT → 유효한 refresh 레코드(user_id 일치·미사용·미철회·미만료).
    mockQuery.mockResolvedValue([
        {
            token_id: 't1',
            user_id: 'u1',
            family_id: 'f1',
            parent_id: null,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            used_at: null,
            revoked_at: null,
        },
    ] as never);
    // withTransaction 의 conn.query → UPDATE(affectedRows:1) → INSERT(ok).
    mockWithTransaction.mockImplementation(
        async (cb: (c: { query: jest.Mock }) => Promise<unknown>) => {
            const connQuery = jest
                .fn()
                .mockResolvedValueOnce({ affectedRows: 1 })
                .mockResolvedValueOnce({});
            return cb({ query: connQuery });
        },
    );
});

describe('POST /auth/refresh — B1 회귀', () => {
    it('iat/exp 가 박힌 access 를 Bearer 로 받아도 500 없이 새 토큰을 회전 발급한다', async () => {
        // 실제 로그인 access 와 동일하게 iat/exp 가 포함된 토큰.
        const access = jwt.sign(
            { userId: 'u1', email: 'u1@test.com' },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' },
        );
        const req = {
            headers: { authorization: `Bearer ${access}` },
            body: { refreshToken: 'r'.repeat(40) },
            get: () => undefined,
            ip: '127.0.0.1',
        } as unknown as Request;

        const { jsonBody, nextErr, status } = await invoke(req);

        // 수정 전에는 "payload already has an exp property" 로 next(err) → 500.
        expect(nextErr).toBeUndefined();
        expect(status).toBe(200);
        expect(jsonBody?.data?.accessToken).toBeTruthy();
        expect(jsonBody?.data?.refreshToken).toBeTruthy();
    });

    it('Authorization 도 body 신원도 없으면 MISSING_IDENTITY_HINT 로 거부(계약 유지)', async () => {
        const req = {
            headers: {},
            body: { refreshToken: 'r'.repeat(40) },
            get: () => undefined,
            ip: '127.0.0.1',
        } as unknown as Request;

        const { nextErr, jsonBody } = await invoke(req);

        expect(jsonBody).toBeUndefined();
        expect((nextErr as { code?: string })?.code).toBe('MISSING_IDENTITY_HINT');
    });
});
