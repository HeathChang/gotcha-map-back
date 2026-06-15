/**
 * Admin 매장 CRUD — store.{create,update,delete} 감사 로그 보강(bc66796) 회귀 방지.
 * 매장은 store.service 가 일반 + 어드민 모두 쓰는 hybrid 라 audit 누락에 취약하다.
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

const STORE_ROW = {
    store_id: 's1',
    name: '강남역점',
    address: '서울시 강남구',
    lat: 37.5,
    lon: 127.0,
    phone: null,
    description: null,
    image_url: null,
    opening_hours: null,
    rating: 4.5,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

describe('Admin 매장 권한', () => {
    it('member 는 매장 목록 라우트 접근 불가 (admin/staff 만)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/stores')
            .set('Authorization', `Bearer ${adminToken('member')}`);
        expect(res.status).toBe(403);
    });
});

describe('POST /api/v1/admin/stores — 감사 로그 보강 회귀 방지', () => {
    it('매장 생성 → INSERT admin_audit_logs(store.create) 호출', async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: 's-new' }] as never)             // SELECT UUID
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // INSERT stores
            .mockResolvedValueOnce([{ ...STORE_ROW, store_id: 's-new' }] as never) // getStore
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .post('/api/v1/admin/stores')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ name: '신규점', address: '서울', lat: 37.5, lon: 127.0 });

        expect(res.status).toBe(200);

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('store.create');
        expect(auditArgs[3]).toBe('store');
    });
});

describe('PATCH /api/v1/admin/stores/:storeId', () => {
    it('필드 변경 → before 스냅샷 + store.update 감사', async () => {
        mockQuery
            .mockResolvedValueOnce([STORE_ROW] as never)                   // before
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // UPDATE
            .mockResolvedValueOnce([{ ...STORE_ROW, name: '강남역점-NEW' }] as never) // after
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .patch('/api/v1/admin/stores/s1')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ name: '강남역점-NEW' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('강남역점-NEW');

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('store.update');
    });

    it('변경 필드 없으면 no-op + 감사 미기록', async () => {
        mockQuery.mockResolvedValueOnce([STORE_ROW] as never);             // before 만

        const res = await request(app)
            .patch('/api/v1/admin/stores/s1')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({});

        expect(res.status).toBe(200);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});

describe('DELETE /api/v1/admin/stores/:storeId', () => {
    it('삭제 → before 스냅샷 + store.delete 감사', async () => {
        mockQuery
            .mockResolvedValueOnce([STORE_ROW] as never)                   // before
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // DELETE
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .delete('/api/v1/admin/stores/s1')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        expect(res.status).toBe(200);

        const auditArgs = mockQuery.mock.calls[2][1] as unknown[];
        expect(auditArgs[2]).toBe('store.delete');
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.name).toBe('강남역점');
    });
});
