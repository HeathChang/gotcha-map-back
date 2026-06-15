/**
 * Admin 매장 가격·재고(store_products) + 카탈로그 오버라이드(store_product_overrides).
 * gotcha-map-policy §4·§5 — 소유권 가드(member 자기 매장만) + 감사 로그 회귀 방지.
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
    store_id: 's1', name: '강남점', address: '서울', lat: 37.5, lon: 127.0,
    phone: null, description: null, image_url: null, opening_hours: null, rating: 4.5,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
};

const SP_JOIN = {
    id: 'sp1', store_id: 's1', product_id: 'p1', price: 5000, stock: 10,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
    product_name: '가챠A', product_image_url: null,
};

beforeEach(() => mockQuery.mockReset());

describe('매장 가격·재고 소유권 (requireStoreOwnership)', () => {
    it('member 가 타 매장 가격 등록 시 403 STORE_OWNERSHIP_FORBIDDEN', async () => {
        const res = await request(app)
            .post('/api/v1/admin/stores/s2/products')
            .set('Authorization', `Bearer ${adminToken('member', 'm1', 's1')}`)
            .send({ productId: 'p1', price: 5000 });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('STORE_OWNERSHIP_FORBIDDEN');
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('배정 매장 없는 member 는 403 NO_ASSIGNED_STORE', async () => {
        const res = await request(app)
            .get('/api/v1/admin/stores/s1/products')
            .set('Authorization', `Bearer ${adminToken('member', 'm1')}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('NO_ASSIGNED_STORE');
    });
});

describe('POST /api/v1/admin/stores/:storeId/products', () => {
    it('member 가 자기 매장에 가격·재고 등록 → 200 + store_product.create 감사', async () => {
        mockQuery
            .mockResolvedValueOnce([STORE_ROW] as never)                 // getStore
            .mockResolvedValueOnce([{ product_id: 'p1' }] as never)      // product exists
            .mockResolvedValueOnce([] as never)                          // dup check
            .mockResolvedValueOnce([{ id: 'sp1' }] as never)             // SELECT UUID
            .mockResolvedValueOnce({ affectedRows: 1 } as never)         // INSERT
            .mockResolvedValueOnce([SP_JOIN] as never)                   // read back
            .mockResolvedValueOnce({ affectedRows: 1 } as never);        // audit

        const res = await request(app)
            .post('/api/v1/admin/stores/s1/products')
            .set('Authorization', `Bearer ${adminToken('member', 'm1', 's1')}`)
            .send({ productId: 'p1', price: 5000, stock: 10 });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ productId: 'p1', price: 5000, stock: 10 });
        const auditArgs = mockQuery.mock.calls[6][1] as unknown[];
        expect(auditArgs[2]).toBe('store_product.create');
        expect(auditArgs[3]).toBe('store_product');
    });

    it('admin 은 임의 매장에 등록 가능 (소유권 통과)', async () => {
        mockQuery
            .mockResolvedValueOnce([{ ...STORE_ROW, store_id: 'sX' }] as never)
            .mockResolvedValueOnce([{ product_id: 'p1' }] as never)
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce([{ id: 'sp9' }] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)
            .mockResolvedValueOnce([{ ...SP_JOIN, id: 'sp9', store_id: 'sX' }] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);

        const res = await request(app)
            .post('/api/v1/admin/stores/sX/products')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ productId: 'p1', price: 7000 });
        expect(res.status).toBe(200);
    });
});

describe('POST /api/v1/admin/stores/:storeId/catalog — 매장 신규 상품', () => {
    it('member 가 productId 없이 매장 신규 상품 추가 → store_override.create 감사', async () => {
        const OVERRIDE_ROW = {
            override_id: 'ov1', store_id: 's1', product_id: null, product_name: '신상가챠',
            product_info: null, image_url: null, price: 3000, stock: null,
            created_by_admin_id: 'm1', created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
        };
        mockQuery
            .mockResolvedValueOnce([STORE_ROW] as never)                 // getStore
            .mockResolvedValueOnce([{ id: 'ov1' }] as never)             // SELECT UUID
            .mockResolvedValueOnce({ affectedRows: 1 } as never)         // INSERT
            .mockResolvedValueOnce([OVERRIDE_ROW] as never)              // read back
            .mockResolvedValueOnce({ affectedRows: 1 } as never);        // audit

        const res = await request(app)
            .post('/api/v1/admin/stores/s1/catalog')
            .set('Authorization', `Bearer ${adminToken('member', 'm1', 's1')}`)
            .send({ productName: '신상가챠', price: 3000 });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ productName: '신상가챠', productId: null });
        const auditArgs = mockQuery.mock.calls[4][1] as unknown[];
        expect(auditArgs[2]).toBe('store_override.create');
    });
});
