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
    sortBy: z.enum(['popular', 'price_asc', 'price_desc']).optional(),
});
export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;

export const productDetailQuerySchema = z.object({
    productId: z.string().min(1, 'productId가 필요합니다.'),
});

export const mainProductsQuerySchema = z.object({
    filters: z
        .union([filterEnum, z.array(filterEnum)])
        .optional()
        .transform(toArray),
});

export const searchProductsSchema = z.object({
    keyword: z.string().max(200).optional(),
    category: z.string().max(100).optional(),
    filter: z.array(filterEnum).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchProductsInput = z.infer<typeof searchProductsSchema>;
