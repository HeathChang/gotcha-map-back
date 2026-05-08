import {
    adminAnswerInquirySchema,
    adminInquiryListQuerySchema,
    adminLoginSchema,
} from '../../src/validators/admin.schema';

describe('admin.schema', () => {
    describe('adminLoginSchema', () => {
        it('유효한 로그인 페이로드를 통과시킨다', () => {
            const result = adminLoginSchema.safeParse({
                email: 'ops@gachamap.io',
                password: 'admin1234',
            });
            expect(result.success).toBe(true);
        });

        it('이메일 형식이 아니면 실패한다', () => {
            const result = adminLoginSchema.safeParse({
                email: 'not-email',
                password: 'admin1234',
            });
            expect(result.success).toBe(false);
        });

        it('빈 비밀번호는 실패한다', () => {
            const result = adminLoginSchema.safeParse({
                email: 'ops@gachamap.io',
                password: '',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('adminInquiryListQuerySchema', () => {
        it('필수 필드 없이도 기본값으로 통과한다', () => {
            const result = adminInquiryListQuerySchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.limit).toBe(20);
                expect(result.data.status).toBeUndefined();
            }
        });

        it('잘못된 status 값은 거부한다', () => {
            const result = adminInquiryListQuerySchema.safeParse({ status: 'wat' });
            expect(result.success).toBe(false);
        });

        it('limit 100 초과는 거부한다', () => {
            const result = adminInquiryListQuerySchema.safeParse({ limit: '500' });
            expect(result.success).toBe(false);
        });

        it('숫자 문자열을 강제로 숫자로 파싱한다', () => {
            const result = adminInquiryListQuerySchema.safeParse({ page: '3', limit: '50' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.limit).toBe(50);
            }
        });
    });

    describe('adminAnswerInquirySchema', () => {
        it('유효한 답변 페이로드를 통과시킨다', () => {
            const result = adminAnswerInquirySchema.safeParse({
                status: 'completed',
                answer: '답변 내용',
            });
            expect(result.success).toBe(true);
        });

        it('빈 answer 는 거부한다', () => {
            const result = adminAnswerInquirySchema.safeParse({
                status: 'completed',
                answer: '',
            });
            expect(result.success).toBe(false);
        });

        it('등록되지 않은 status enum 은 거부한다', () => {
            const result = adminAnswerInquirySchema.safeParse({
                status: 'archived',
                answer: '답변',
            });
            expect(result.success).toBe(false);
        });
    });
});
