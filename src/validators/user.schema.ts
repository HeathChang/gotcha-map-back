import { z } from 'zod';

export const signupSchema = z.object({
    email: z.string().email('유효한 이메일 형식이 아닙니다.').max(255),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.').max(128),
    nickname: z.string().min(1).max(50),
    gender: z.enum(['M', 'F']).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const getUserQuerySchema = z.object({
    userId: z.string().min(1, 'userId가 필요합니다.'),
});

export const updateUserSchema = z.object({
    email: z.string().email().max(255).optional(),
    nickname: z.string().min(1).max(50).optional(),
    gender: z.enum(['M', 'F']).optional(),
    profileImageUrl: z.string().max(500).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, '기존 비밀번호가 필요합니다.'),
    newPassword: z.string().min(8, '새 비밀번호는 최소 8자 이상이어야 합니다.').max(128),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
    userId: z.string().min(1),
    email: z.string().email(),
    newPassword: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
