/**
 * Admin 제품 — 통합 검증 핵심:
 *  - 목록(lean) 응답 형태 (tag_count/image_count 노출)
 *  - 상세 응답 (갤러리 + 태그 JOIN)
 *  - 생성/수정의 withTransaction 흐름 + assertTagsExist 사전 검증
 *  - 가격 역전(minPrice > maxPrice) zod refine 거부
 */
import request from 'supertest';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../../src/app';
import { query, withTransaction } from '../../../src/config/database';
import { adminToken } from '../../helpers/adminToken';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

// 트랜잭션 conn 모킹 — 내부 INSERT/UPDATE 는 affectedRows=1 로 통일.
// withTransaction 의 시그니처(PoolConnection 전달)는 테스트에서 모킹 캐스팅으로 우회한다.
function mockTransactionSucceed() {
    (mockWithTransaction as unknown as jest.Mock).mockImplementation(
        async (cb: (c: { query: jest.Mock }) => Promise<unknown>) => {
            const conn = { query: jest.fn().mockResolvedValue({ affectedRows: 1 }) };
            return cb(conn);
        },
    );
}

const PRODUCT_ROW = {
    product_id: 'p1',
    product_name: '치이카와 키링',
    product_manufacturer: '반다이',
    product_info: null,
    category: '키링',
    min_price: 5000,
    max_price: 5000,
    image_url: null,
    view_count: 10,
    is_new: 0,
    is_popular: 1,
    gender_target: 'ALL' as const,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

describe('GET /api/v1/admin/products', () => {
    it('목록은 lean 응답 — tagCount/imageCount 노출', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([
                { ...PRODUCT_ROW, tag_count: 2, image_count: 3 },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/products')
            .set('Authorization', `Bearer ${adminToken('staff')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0]).toMatchObject({
            productId: 'p1',
            productName: '치이카와 키링',
            tagCount: 2,
            imageCount: 3,
            isPopular: true,
        });
    });
});

describe('GET /api/v1/admin/products/:productId', () => {
    it('상세는 images[] + tags[] 포함', async () => {
        mockQuery
            .mockResolvedValueOnce([PRODUCT_ROW] as never)                 // SELECT product
            .mockResolvedValueOnce([                                       // images
                { image_url: 'https://img/1.jpg' },
                { image_url: 'https://img/2.jpg' },
            ] as never)
            .mockResolvedValueOnce([                                       // tags JOIN
                { tag_id: 't1', name: '치이카와', relation_type: 'character' },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/products/p1')
            .set('Authorization', `Bearer ${adminToken('staff')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.images).toEqual(['https://img/1.jpg', 'https://img/2.jpg']);
        expect(res.body.data.tags).toEqual([
            { tagId: 't1', name: '치이카와', relationType: 'character' },
        ]);
    });
});

describe('POST /api/v1/admin/products', () => {
    it('가격 역전(minPrice > maxPrice) 시 400 — zod refine', async () => {
        const res = await request(app)
            .post('/api/v1/admin/products')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ productName: 'X', minPrice: 10000, maxPrice: 5000 });
        expect(res.status).toBe(400);
    });

    it('tagIds 가 사전 존재 검증을 통과해야 트랜잭션 진입', async () => {
        mockTransactionSucceed();
        mockQuery
            // assertTagsExist: SELECT tag_id WHERE IN — 한 개만 존재 (요청은 두 개)
            .mockResolvedValueOnce([{ tag_id: 't1' }] as never);

        const res = await request(app)
            .post('/api/v1/admin/products')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({
                productName: '신상',
                minPrice: 1000,
                maxPrice: 2000,
                tagIds: ['t1', 't-missing'],
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('TAG_NOT_FOUND');
        // 트랜잭션이 호출되기 전에 검증에서 차단됨
        expect(mockWithTransaction).not.toHaveBeenCalled();
    });

    it('이미지/태그 없는 단순 생성 → 트랜잭션 + 감사 로그', async () => {
        mockTransactionSucceed();
        const newId = 'p-new';
        mockQuery
            .mockResolvedValueOnce([{ id: newId }] as never)               // SELECT UUID
            // 트랜잭션은 mockTransactionSucceed 가 처리
            .mockResolvedValueOnce([{ ...PRODUCT_ROW, product_id: newId }] as never) // detail SELECT product
            .mockResolvedValueOnce([] as never)                            // detail images
            .mockResolvedValueOnce([] as never)                            // detail tags
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit

        const res = await request(app)
            .post('/api/v1/admin/products')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ productName: '신상', minPrice: 1000, maxPrice: 2000 });

        expect(res.status).toBe(200);
        expect(res.body.data.productId).toBe(newId);
        expect(mockWithTransaction).toHaveBeenCalledTimes(1);

        // 마지막 query 호출이 audit_log
        const calls = mockQuery.mock.calls;
        const auditCall = calls[calls.length - 1];
        expect(auditCall[0]).toContain('INSERT INTO admin_audit_logs');
        const auditArgs = auditCall[1] as unknown[];
        expect(auditArgs[2]).toBe('product.create');
    });
});
