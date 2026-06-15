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
    it('상태 변경 → 감사 로그 user.status 기록 + 풀 노출 응답', async () => {
        mockQuery
            .mockResolvedValueOnce([FIXTURE_USER] as never)                // before
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // UPDATE
            .mockResolvedValueOnce([{ ...FIXTURE_USER, user_status: 0 }] as never) // after
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .patch('/api/v1/admin/users/u1/status')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ status: 0 });

        expect(res.status).toBe(200);
        expect(res.body.data.userStatus).toBe(0);
        // staff 도 admin 과 동일하게 이메일 풀 노출
        expect(res.body.data.email).toBe('alice@example.com');

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('user.status');
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.userStatus).toBe(1);
        expect(diff.after.userStatus).toBe(0);
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
