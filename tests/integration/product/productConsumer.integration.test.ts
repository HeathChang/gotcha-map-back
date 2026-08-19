/**
 * H5 회귀 — 소비자 제품 응답의 boolean 정규화(TINYINT 0/1 방지).
 * is_new/is_popular 는 DB 에서 TINYINT(0/1) 로 오므로, 소비자 뱃지 로직(=== true)이
 * 깨지지 않도록 매퍼가 boolean 으로 정규화해야 한다. (INT 필드는 그대로 number.)
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import { query } from '../../../src/config/database';
import { getMainProductsList } from '../../../src/services/product.service';

const mockQuery = query as jest.MockedFunction<typeof query>;

const productRow = {
    product_id: 'p1',
    product_name: '상품',
    product_manufacturer: null,
    product_info: null,
    category: null,
    min_price: 5000,
    max_price: 7000,
    image_url: null,
    view_count: 10,
    is_new: 0, // TINYINT
    is_popular: 1, // TINYINT
    gender_target: 'ALL',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
};

beforeEach(() => mockQuery.mockReset());

describe('H5 — 소비자 제품 응답 boolean 정규화', () => {
    it('is_new(0)/is_popular(1) TINYINT 를 boolean 으로 반환, INT(min_price)는 number 유지', async () => {
        mockQuery.mockResolvedValueOnce([productRow] as never); // NEW 필터 1개 쿼리

        const result = await getMainProductsList(['NEW']);
        const p = result.NEW[0];

        expect(typeof p.isNew).toBe('boolean');
        expect(typeof p.isPopular).toBe('boolean');
        expect(p.isNew).toBe(false);
        expect(p.isPopular).toBe(true);
        expect(typeof p.minPrice).toBe('number');
        expect(p.minPrice).toBe(5000);
    });
});
