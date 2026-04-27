import { z } from 'zod';

export const nearbyStoresSchema = z.object({
    lat: z.coerce.number().gte(-90).lte(90),
    lon: z.coerce.number().gte(-180).lte(180),
    radiusKm: z.coerce.number().positive().max(500),
});
export type NearbyStoresInput = z.infer<typeof nearbyStoresSchema>;

export const storeByIdQuerySchema = z.object({
    storeId: z.string().min(1, 'storeId가 필요합니다.'),
});

export const storeByProductQuerySchema = z.object({
    productId: z.string().min(1, 'productId가 필요합니다.'),
});
