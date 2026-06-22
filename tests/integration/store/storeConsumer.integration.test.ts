/**
 * 소비자 매장 조회 — 옵션 A 병합(gotcha-map-policy §5) 회귀 방지.
 *  - getStoreGachaList(productId): 가격 비교 = store_products(원본) + 매장 오버라이드(추가본), source 플래그.
 *  - getStoreCatalog(storeId): 매장 취급 상품 = 카탈로그 + 매장 추가본. productId=null 오버라이드는 override_id 를 키로.
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import { query } from '../../../src/config/database';
import { getStoreCatalog, getStoreGachaList } from '../../../src/services/store.service';

const mockQuery = query as jest.MockedFunction<typeof query>;

const storeRow = (over: Partial<Record<string, unknown>> = {}) => ({
    store_id: 's1', name: '강남점', address: '서울', lat: 37.5, lon: 127.0,
    phone: null, description: null, image_url: null, opening_hours: null, rating: 4.5,
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
    ...over,
});

beforeEach(() => mockQuery.mockReset());

describe('getStoreGachaList — 가격 비교 옵션 A 병합', () => {
    it('카탈로그(원본) 먼저, 매장 오버라이드(추가본) 뒤 + source 플래그', async () => {
        mockQuery
            .mockResolvedValueOnce([storeRow({ price: 5000, stock: 3 })] as never)            // catalog
            .mockResolvedValueOnce([storeRow({ store_id: 's2', price: 6000, stock: 1 })] as never); // override

        const list = (await getStoreGachaList('p1')) as Array<{ source: string; price: number }>;

        expect(list).toHaveLength(2);
        expect(list[0].source).toBe('catalog');
        expect(list[0].price).toBe(5000);
        expect(list[1].source).toBe('store');
        expect(list[1].price).toBe(6000);
    });
});

describe('getStoreCatalog — 매장 취급 상품', () => {
    it('카탈로그 + 매장 추가본, productId=null 오버라이드는 override_id 를 productId 로', async () => {
        mockQuery
            .mockResolvedValueOnce([storeRow()] as never)                                      // getStore 존재 검증
            .mockResolvedValueOnce([
                {
                    product_id: 'p1', product_name: '카탈로그상품', product_manufacturer: null,
                    product_info: null, category: null, image_url: null,
                    is_new: 0, is_popular: 0, gender_target: 'ALL', price: 4200, stock: 5,
                },
            ] as never)                                                                        // catalog JOIN
            .mockResolvedValueOnce([
                {
                    override_id: 'o1', product_id: null, product_name: '매장 한정 신상',
                    product_info: null, image_url: null, price: 9900, stock: 2,
                },
            ] as never);                                                                       // overrides

        const list = (await getStoreCatalog('s1')) as Array<{
            productId: string; productName: string; source: string; minPrice: number;
        }>;

        expect(list).toHaveLength(2);
        expect(list[0]).toMatchObject({ productId: 'p1', source: 'catalog', minPrice: 4200 });
        // productId 가 null 이면 override_id 를 카드 키로 사용
        expect(list[1]).toMatchObject({ productId: 'o1', productName: '매장 한정 신상', source: 'store', minPrice: 9900 });
    });
});
