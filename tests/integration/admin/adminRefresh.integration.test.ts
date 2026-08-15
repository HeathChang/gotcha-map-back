/**
 * C1 회귀(어드민) — POST /admin/refresh 는 client access 의 role/kind 를 신뢰하지 않는다.
 *
 * rotateAdminRefresh 가 admin_refresh_tokens 레코드의 admin_id 로 admin_users 를 재조회해
 * role/storeId 를 DB 기준으로 재구성한다. → member(매장점주)가 위조 role:admin 을 보내도
 * 발급 토큰의 role 은 DB 값(member)이라 admin 자가승격이 불가능하다.
 *
 * query 호출 순서: ① admin_refresh_tokens SELECT ② admin_users SELECT(신원).
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { query, withTransaction } from '../../../src/config/database';
import { refresh } from '../../../src/controllers/admin.controller';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as unknown as jest.Mock;

interface InvokeResult {
    jsonBody?: { data?: { accessToken?: string } };
    nextErr?: { code?: string } | unknown;
    status?: number;
}

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

const ADMIN_REFRESH_ROW = {
    token_id: 't1',
    admin_id: 'a1',
    family_id: 'f1',
    parent_id: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    used_at: null,
    revoked_at: null,
};

function mockDbSequence(adminRows: unknown[]): void {
    mockQuery.mockReset();
    mockQuery
        .mockResolvedValueOnce([ADMIN_REFRESH_ROW] as never)
        .mockResolvedValueOnce(adminRows as never);
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

describe('POST /admin/refresh — C1 신원 재구성(어드민)', () => {
    it('member 가 위조 Bearer(role:admin)를 보내도 발급 토큰 role 은 DB 값(member)', async () => {
        mockDbSequence([
            { admin_id: 'a1', email: 'm1@test.com', role: 'member', store_id: 's1' },
        ]);
        // 서명은 무의미 — 서버는 이 토큰을 decode 조차 하지 않는다.
        const forged = jwt.sign(
            { userId: 'a1', email: 'm1@test.com', kind: 'admin', role: 'admin' },
            'attacker-secret',
            { expiresIn: '15m' },
        );
        const { jsonBody, status } = await invoke(
            requestWith({ authorization: `Bearer ${forged}` }),
        );

        expect(status).toBe(200);
        const decoded = jwt.decode(jsonBody?.data?.accessToken as string) as {
            kind?: string;
            role?: string;
            storeId?: string | null;
        } | null;
        expect(decoded?.kind).toBe('admin');
        expect(decoded?.role).toBe('member'); // 위조 admin 이 아니라 DB 의 member
        expect(decoded?.storeId).toBe('s1');
    });

    it('비활성 관리자(admin_users status≠1 → 0건)면 INVALID_REFRESH_TOKEN 으로 거부', async () => {
        mockDbSequence([]);
        const { nextErr, jsonBody } = await invoke(requestWith({}));

        expect(jsonBody).toBeUndefined();
        expect((nextErr as { code?: string })?.code).toBe('INVALID_REFRESH_TOKEN');
    });
});
