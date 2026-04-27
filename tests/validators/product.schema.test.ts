import {
    getProductsQuerySchema,
    searchProductsSchema,
    productDetailQuerySchema,
    mainProductsQuerySchema,
} from '../../src/validators/product.schema';

describe('product.schema', () => {
    describe('getProductsQuerySchema', () => {
        it('applies defaults for page and limit', () => {
            const r = getProductsQuerySchema.parse({});
            expect(r.page).toBe(1);
            expect(r.limit).toBe(20);
            expect(r.filter).toBeUndefined();
        });

        it('coerces string query params to numbers', () => {
            const r = getProductsQuerySchema.parse({ page: '3', limit: '50' });
            expect(r.page).toBe(3);
            expect(r.limit).toBe(50);
        });

        it('normalizes single filter into array', () => {
            const r = getProductsQuerySchema.parse({ filter: 'NEW' });
            expect(r.filter).toEqual(['NEW']);
        });

        it('keeps array filter as-is', () => {
            const r = getProductsQuerySchema.parse({ filter: ['NEW', 'POPULAR'] });
            expect(r.filter).toEqual(['NEW', 'POPULAR']);
        });

        it('rejects invalid filter value', () => {
            expect(getProductsQuerySchema.safeParse({ filter: 'BOGUS' }).success).toBe(false);
        });

        it('rejects invalid sortBy', () => {
            expect(getProductsQuerySchema.safeParse({ sortBy: 'random' }).success).toBe(false);
        });

        it('caps limit at 100', () => {
            expect(getProductsQuerySchema.safeParse({ limit: 200 }).success).toBe(false);
        });
    });

    describe('searchProductsSchema', () => {
        it('accepts only optional fields', () => {
            const r = searchProductsSchema.parse({});
            expect(r.page).toBe(1);
            expect(r.limit).toBe(20);
        });

        it('rejects overly long keyword', () => {
            expect(searchProductsSchema.safeParse({ keyword: 'x'.repeat(201) }).success).toBe(
                false,
            );
        });
    });

    describe('productDetailQuerySchema', () => {
        it('requires productId', () => {
            expect(productDetailQuerySchema.safeParse({ productId: 'p1' }).success).toBe(true);
            expect(productDetailQuerySchema.safeParse({}).success).toBe(false);
        });
    });

    describe('mainProductsQuerySchema', () => {
        it('normalizes filters to array', () => {
            expect(mainProductsQuerySchema.parse({ filters: 'NEW' }).filters).toEqual(['NEW']);
            expect(mainProductsQuerySchema.parse({ filters: ['NEW', 'MALE'] }).filters).toEqual([
                'NEW',
                'MALE',
            ]);
            expect(mainProductsQuerySchema.parse({}).filters).toBeUndefined();
        });
    });
});
