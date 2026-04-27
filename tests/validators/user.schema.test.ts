import {
    signupSchema,
    loginSchema,
    changePasswordSchema,
    updateUserSchema,
    resetPasswordSchema,
    getUserQuerySchema,
} from '../../src/validators/user.schema';

describe('user.schema', () => {
    describe('signupSchema', () => {
        it('accepts a valid signup payload', () => {
            const result = signupSchema.safeParse({
                email: 'a@b.com',
                password: 'password1',
                nickname: 'heath',
                gender: 'M',
            });
            expect(result.success).toBe(true);
        });

        it('allows gender to be omitted', () => {
            const result = signupSchema.safeParse({
                email: 'a@b.com',
                password: 'password1',
                nickname: 'heath',
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid email', () => {
            const result = signupSchema.safeParse({
                email: 'not-email',
                password: 'password1',
                nickname: 'heath',
            });
            expect(result.success).toBe(false);
        });

        it('rejects password shorter than 8 chars', () => {
            const result = signupSchema.safeParse({
                email: 'a@b.com',
                password: 'short',
                nickname: 'heath',
            });
            expect(result.success).toBe(false);
        });

        it('rejects invalid gender enum', () => {
            const result = signupSchema.safeParse({
                email: 'a@b.com',
                password: 'password1',
                nickname: 'heath',
                gender: 'X',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('loginSchema', () => {
        it('accepts valid credentials', () => {
            expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
        });

        it('rejects missing password', () => {
            expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
        });
    });

    describe('changePasswordSchema', () => {
        it('requires new password >= 8 chars', () => {
            expect(
                changePasswordSchema.safeParse({ oldPassword: 'old', newPassword: 'short' }).success,
            ).toBe(false);
            expect(
                changePasswordSchema.safeParse({ oldPassword: 'old', newPassword: 'longenough' })
                    .success,
            ).toBe(true);
        });
    });

    describe('updateUserSchema', () => {
        it('accepts empty object (all fields optional)', () => {
            expect(updateUserSchema.safeParse({}).success).toBe(true);
        });

        it('rejects invalid email when provided', () => {
            expect(updateUserSchema.safeParse({ email: 'bad' }).success).toBe(false);
        });
    });

    describe('resetPasswordSchema', () => {
        it('requires all three fields', () => {
            expect(
                resetPasswordSchema.safeParse({
                    userId: 'u1',
                    email: 'a@b.com',
                    newPassword: 'longenough',
                }).success,
            ).toBe(true);
            expect(resetPasswordSchema.safeParse({ userId: 'u1', email: 'a@b.com' }).success).toBe(
                false,
            );
        });
    });

    describe('getUserQuerySchema', () => {
        it('requires userId', () => {
            expect(getUserQuerySchema.safeParse({ userId: 'u1' }).success).toBe(true);
            expect(getUserQuerySchema.safeParse({}).success).toBe(false);
        });
    });
});
