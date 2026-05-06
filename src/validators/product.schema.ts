import { z } from 'zod';

export const filterEnum = z.enum(['FEMALE', 'MALE', 'POPULAR', 'NEW']);
export type Filter = z.infer<typeof filterEnum>;

const toArray = <T>(val: T | T[] | undefined): T[] | undefined =>
    val === undefined ? undefined : Array.isArray(val) ? val : [val];

export const getProductsQuerySchema = z.object({
    category: z.string().max(100).optional(),
    filter: z
        .union([filterEnum, z.array(filterEnum)])
        .optional()
        .transform(toArray),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    // 'new'는 FE v1 호환을 위한 추가. 내부적으로는 created_at DESC 와 동일.
    sortBy: z.enum(['popular', 'new', 'price_asc', 'price_desc']).optional(),
});
export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;

export const productDetailQuerySchema = z.object({
    productId: z.string().min(1, 'productId가 필요합니다.'),
});

// FE v1 호환: 클라이언트에 따라 `filter` 또는 `filters` 로 보낸다.
// preprocess 단계에서 두 키를 합쳐 단일 `filters` 배열로 정규화.
export const mainProductsQuerySchema = z.preprocess((raw) => {
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (obj.filters === undefined && obj.filter !== undefined) {
            return { filters: obj.filter };
        }
    }
    return raw;
}, z.object({
    filters: z
        .union([filterEnum, z.array(filterEnum)])
        .optional()
        .transform(toArray),
}));

export const searchProductsSchema = z.object({
    keyword: z.string().max(200).optional(),
    category: z.string().max(100).optional(),
    filter: z.array(filterEnum).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchProductsInput = z.infer<typeof searchProductsSchema>;
