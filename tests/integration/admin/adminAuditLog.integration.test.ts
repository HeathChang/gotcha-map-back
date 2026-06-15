/**
 * Admin 감사 로그 — 읽기 전용, admin 전용. admin_users JOIN 응답 형태.
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

describe('GET /api/v1/admin/audit-logs', () => {
    it('admin 외 모든 역할 차단 — staff 403', async () => {
        const res = await request(app)
            .get('/api/v1/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken('staff')}`);
        expect(res.status).toBe(403);
    });

    it('member 도 403 (감사 로그는 admin 전용)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken('member')}`);
        expect(res.status).toBe(403);
    });

    it('admin: admin_users JOIN 결과 — adminEmail/adminName 노출, diff JSON 파싱', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([
                {
                    audit_id: 'a1',
                    admin_id: 'admin-1',
                    admin_email: 'ops@gachamap.io',
                    admin_name: '운영자',
                    action: 'tag.create',
                    target_type: 'tag',
                    target_id: 't1',
                    diff: JSON.stringify({ after: { name: '신상' } }),
                    ip: '127.0.0.1',
                    user_agent: 'jest',
                    created_at: new Date('2026-05-30'),
                },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/audit-logs')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0]).toMatchObject({
            auditId: 'a1',
            adminEmail: 'ops@gachamap.io',
            adminName: '운영자',
            action: 'tag.create',
            // diff 가 JSON 문자열이면 service 가 파싱해서 객체로 반환해야 함
            diff: { after: { name: '신상' } },
        });
    });

    it('targetType 필터 — 쿼리 파라미터가 WHERE 인자로', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 0 }] as never)
            .mockResolvedValueOnce([] as never);

        await request(app)
            .get('/api/v1/admin/audit-logs?targetType=tag')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        const countArgs = mockQuery.mock.calls[0][1] as unknown[];
        expect(countArgs).toContain('tag');
    });
});
