/**
 * Admin 회원 — 접근 권한 + PII 노출 정책의 컨트롤러 통합 검증.
 * gotcha-map-policy §7 (Q2 확정): admin·staff 모두 이메일 풀 노출. member 는 회원 라우트 접근 불가.
 * (마스킹 유틸 자체 검증은 tests/utils/mask.test.ts 에 있음.)
 */
import request from 'supertest';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../../src/app';
import { query } from '../../../src/config/database';
import { adminToken } from '../../helpers/adminToken';

const mockQuery = query as jest.MockedFunction<typeof query>;

const FIXTURE_USER = {
    user_id: 'u1',
    email: 'alice@example.com',
    nickname: 'alice',
    gender: 'F',
    profile_image_url: null,
    user_status: 1,
    user_flag: 0,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-05-01'),
};

describe('GET /api/v1/admin/users — 접근 권한 + PII 노출', () => {
    it('admin: 이메일 풀 노출', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([FIXTURE_USER] as never);

        const res = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0].email).toBe('alice@example.com');
    });

    it('staff: 이메일 풀 노출 (admin 과 동일)', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([FIXTURE_USER] as never);

        const res = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminToken('staff')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0].email).toBe('alice@example.com');
    });

    it('member 는 회원 라우트 접근 불가 — 403', async () => {
        const res = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminToken('member')}`);
        expect(res.status).toBe(403);
    });

    it('status=1 쿼리 → user_status 컬럼이 WHERE 인자로', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 0 }] as never)
            .mockResolvedValueOnce([] as never);

        await request(app)
            .get('/api/v1/admin/users?status=1')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        const countArgs = mockQuery.mock.calls[0][1] as unknown[];
        expect(countArgs).toContain(1);
    });
});

describe('PATCH /api/v1/admin/users/:userId/status', () => {
    it('상태 변경(비활성) → refresh 토큰 철회 + 감사 로그 user.status 기록 + 풀 노출 응답', async () => {
        mockQuery
            .mockResolvedValueOnce([FIXTURE_USER] as never)                // before getAdminUser
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // UPDATE users
            .mockResolvedValueOnce({ affectedRows: 2 } as never)           // H1: revoke refresh_tokens
            .mockResolvedValueOnce([{ ...FIXTURE_USER, user_status: 0 }] as never) // after getAdminUser
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .patch('/api/v1/admin/users/u1/status')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ status: 0 });

        expect(res.status).toBe(200);
        expect(res.body.data.userStatus).toBe(0);
        // staff 도 admin 과 동일하게 이메일 풀 노출
        expect(res.body.data.email).toBe('alice@example.com');

        // H1: 비활성(상태≠1) 전환 시 해당 회원 refresh 토큰 철회 쿼리가 발생해야 한다.
        const revokeCall = mockQuery.mock.calls.find((c) =>
            /refresh_tokens\s+SET\s+revoked_at/i.test(String(c[0])),
        );
        expect(revokeCall).toBeTruthy();
        expect((revokeCall?.[1] as unknown[])?.[0]).toBe('u1');

        const auditArgs = mockQuery.mock.calls[4][1] as unknown[];
        expect(auditArgs[2]).toBe('user.status');
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.userStatus).toBe(1);
        expect(diff.after.userStatus).toBe(0);
    });

    it('H1: 재활성화(status=1)로의 변경은 refresh 토큰을 철회하지 않는다', async () => {
        mockQuery
            .mockResolvedValueOnce([{ ...FIXTURE_USER, user_status: 0 }] as never) // before (현재 비활성)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)                    // UPDATE users
            .mockResolvedValueOnce([FIXTURE_USER] as never)                         // after (활성)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);                   // audit

        const res = await request(app)
            .patch('/api/v1/admin/users/u1/status')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ status: 1 });

        expect(res.status).toBe(200);
        const revokeCall = mockQuery.mock.calls.find((c) =>
            /refresh_tokens\s+SET\s+revoked_at/i.test(String(c[0])),
        );
        expect(revokeCall).toBeUndefined();
    });

    it('동일 상태로의 변경은 no-op + 감사 미기록 (UPDATE 호출 안 함)', async () => {
        mockQuery.mockResolvedValueOnce([FIXTURE_USER] as never);          // before 만 호출됨

        const res = await request(app)
            .patch('/api/v1/admin/users/u1/status')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ status: 1 }); // FIXTURE_USER.user_status 와 동일

        expect(res.status).toBe(200);
        expect(mockQuery).toHaveBeenCalledTimes(1); // before getAdminUser 만
    });

    it('status 값 검증 — 1/0/-1 외에는 400', async () => {
        const res = await request(app)
            .patch('/api/v1/admin/users/u1/status')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ status: 2 });
        expect(res.status).toBe(400);
    });
});
