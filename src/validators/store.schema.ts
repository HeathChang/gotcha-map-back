import { z } from 'zod';

export const nearbyStoresSchema = z.object({
    lat: z.coerce.number().gte(-90).lte(90),
    lon: z.coerce.number().gte(-180).lte(180),
    radiusKm: z.coerce.number().positive().max(500),
    // 선택: 결과 상한. 미지정 시 서비스 기본값(100). 과도한 응답 방지 위해 300 으로 캡.
    limit: z.coerce.number().int().positive().max(300).optional(),
});
export type NearbyStoresInput = z.infer<typeof nearbyStoresSchema>;

export const storeByIdQuerySchema = z.object({
    storeId: z.string().min(1, 'storeId가 필요합니다.'),
});

export const storeByProductQuerySchema = z.object({
    productId: z.string().min(1, 'productId가 필요합니다.'),
});
