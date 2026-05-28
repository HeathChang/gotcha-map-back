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

// 어드민 태그 관리 —————————————————————————————————————————————

export const adminTagListQuerySchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    // relationType 분류로 좁혀 보기. tags.relation_type 부분이 아니라 정확 일치.
    relationType: z.string().trim().min(1).max(50).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminTagListQuery = z.infer<typeof adminTagListQuerySchema>;

export const adminCreateTagSchema = z.object({
    name: z.string().trim().min(1, '태그명을 입력해주세요.').max(100),
    relationType: z.string().trim().max(50).optional().nullable(),
});
export type AdminCreateTagInput = z.infer<typeof adminCreateTagSchema>;

export const adminUpdateTagSchema = adminCreateTagSchema.partial();
export type AdminUpdateTagInput = z.infer<typeof adminUpdateTagSchema>;

// 어드민 공지 관리 —————————————————————————————————————————————

export const adminAnnouncementListQuerySchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    // 쿼리스트링은 문자열이라 'true'/'false' 로 받아 boolean 으로 변환한다.
    isActive: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminAnnouncementListQuery = z.infer<typeof adminAnnouncementListQuerySchema>;

export const adminCreateAnnouncementSchema = z.object({
    title: z.string().trim().min(1, '제목을 입력해주세요.').max(255),
    content: z.string().trim().min(1, '내용을 입력해주세요.').max(10000),
    isActive: z.boolean().optional().default(true),
});
export type AdminCreateAnnouncementInput = z.infer<typeof adminCreateAnnouncementSchema>;

export const adminUpdateAnnouncementSchema = adminCreateAnnouncementSchema.partial();
export type AdminUpdateAnnouncementInput = z.infer<typeof adminUpdateAnnouncementSchema>;

// 어드민 감사 로그 (읽기 전용, super_admin) ——————————————————————————

export const adminAuditLogListQuerySchema = z.object({
    // 정확 일치 필터. target_type 예: tag / announcement / store / inquiry.
    targetType: z.string().trim().min(1).max(32).optional(),
    action: z.string().trim().min(1).max(64).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminAuditLogListQuery = z.infer<typeof adminAuditLogListQuerySchema>;
