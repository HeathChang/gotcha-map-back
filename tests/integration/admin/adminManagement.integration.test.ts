/**
 * Admin 운영자 관리(/admin/admins) — admin 전용. gotcha-map-policy §9 (Q5).
 * 계정 생성(member 매장 배정) / 목록 / 권한 차단 + 감사 로그.
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

const MANAGED_ROW = {
    admin_id: 'a1', email: 'staff@x.com', name: '스태프', role: 'staff',
    store_id: null, store_name: null, admin_status: 1,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
};

beforeEach(() => mockQuery.mockReset());

describe('운영자 관리 권한 (admin 전용)', () => {
    it('staff 는 403', async () => {
        const res = await request(app)
            .get('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${adminToken('staff')}`);
        expect(res.status).toBe(403);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('member 는 403', async () => {
        const res = await request(app)
            .get('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${adminToken('member', 'm1', 's1')}`);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/v1/admin/admins', () => {
    it('admin: 목록 조회 (매장명 JOIN 포함)', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)   // COUNT
            .mockResolvedValueOnce([MANAGED_ROW] as never);   // SELECT

        const res = await request(app)
            .get('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${adminToken('admin')}`);
        expect(res.status).toBe(200);
        expect(res.body.data.items[0]).toMatchObject({ adminId: 'a1', role: 'staff' });
    });
});

describe('POST /api/v1/admin/admins', () => {
    it('admin 이 staff 계정 생성 → admin_user.create 감사', async () => {
        mockQuery
            .mockResolvedValueOnce([] as never)               // 이메일 중복 없음
            .mockResolvedValueOnce([{ id: 'a-new' }] as never) // SELECT UUID
            .mockResolvedValueOnce({ affectedRows: 1 } as never) // INSERT
            .mockResolvedValueOnce([{ ...MANAGED_ROW, admin_id: 'a-new' }] as never) // read back
            .mockResolvedValueOnce({ affectedRows: 1 } as never); // audit

        const res = await request(app)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ email: 'new@x.com', password: 'password123', name: '신규', role: 'staff' });

        expect(res.status).toBe(200);
        const auditArgs = mockQuery.mock.calls[4][1] as unknown[];
        expect(auditArgs[2]).toBe('admin_user.create');
        expect(auditArgs[3]).toBe('admin_user');
    });

    it('member 생성 시 storeId 누락이면 400 (검증 거부)', async () => {
        const res = await request(app)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ email: 'mgr@x.com', password: 'password123', name: '점주', role: 'member' });
        expect(res.status).toBe(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
