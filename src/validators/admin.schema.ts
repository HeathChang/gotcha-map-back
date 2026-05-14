import { z } from 'zod';

export const adminLoginSchema = z.object({
    email: z.string().email('유효한 이메일 형식이 아닙니다.').max(255),
    password: z.string().min(1, '비밀번호를 입력해주세요.').max(128),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminInquiryListQuerySchema = z.object({
    status: z.enum(['pending', 'processing', 'completed', 'rejected']).optional(),
    // 운영자가 제목/요청자 이메일에서 키워드를 찾을 수 있게 한다. 부분 일치(LIKE) 검색.
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminInquiryListQuery = z.infer<typeof adminInquiryListQuerySchema>;

export const adminAnswerInquirySchema = z.object({
    status: z.enum(['pending', 'processing', 'completed', 'rejected']),
    answer: z.string().min(1, '답변 내용을 입력해주세요.').max(5000),
});
export type AdminAnswerInquiryInput = z.infer<typeof adminAnswerInquirySchema>;

// 어드민 매장 관리 —————————————————————————————————————————————

export const adminStoreListQuerySchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminStoreListQuery = z.infer<typeof adminStoreListQuerySchema>;

export const adminCreateStoreSchema = z.object({
    name: z.string().trim().min(1, '매장명을 입력해주세요.').max(255),
    address: z.string().trim().min(1, '주소를 입력해주세요.').max(500),
    lat: z.coerce.number().gte(-90).lte(90),
    lon: z.coerce.number().gte(-180).lte(180),
    phone: z.string().trim().max(20).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    imageUrl: z.string().trim().url('유효한 이미지 URL이 아닙니다.').max(512).optional().nullable(),
    openingHours: z.string().trim().max(255).optional().nullable(),
    rating: z.coerce.number().min(0).max(5).optional(),
});
export type AdminCreateStoreInput = z.infer<typeof adminCreateStoreSchema>;

// PATCH 라 모든 필드를 optional 로. lat/lon 은 짝으로 들어와야 한다.
export const adminUpdateStoreSchema = adminCreateStoreSchema.partial().refine(
    (data) => (data.lat === undefined) === (data.lon === undefined),
    { message: 'lat 과 lon 은 함께 보내야 합니다.' },
);
export type AdminUpdateStoreInput = z.infer<typeof adminUpdateStoreSchema>;
