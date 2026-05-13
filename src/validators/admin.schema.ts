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
