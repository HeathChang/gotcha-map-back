import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as userCtrl from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { env } from '../config/env';
import {
    signupSchema,
    loginSchema,
    getUserQuerySchema,
    updateUserSchema,
    changePasswordSchema,
    requestPasswordResetSchema,
    confirmPasswordResetSchema,
} from '../validators/user.schema';

export const userRouter = Router();

const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { data: null, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

userRouter.post('/signup', authLimiter, validate(signupSchema), userCtrl.signup);
userRouter.post('/login', authLimiter, validate(loginSchema), userCtrl.login);

userRouter.get('/users', validate(getUserQuerySchema, 'query'), userCtrl.getUser);

userRouter.patch('/users/info', authMiddleware, validate(updateUserSchema), userCtrl.updateUser);

userRouter.patch(
    '/users/password',
    authMiddleware,
    validate(changePasswordSchema),
    userCtrl.changePassword,
);

// 비밀번호 재설정: 2단계 토큰 흐름 (auth.md)
//   1) 토큰 발급(이메일로 전달)
//   2) 토큰 검증 후 비밀번호 변경
// 기존 v1 `/users/reset-password` 는 보안 결함으로 제거됨.
userRouter.post(
    '/users/password-reset/request',
    authLimiter,
    validate(requestPasswordResetSchema),
    userCtrl.requestPasswordReset,
);

userRouter.post(
    '/users/password-reset/confirm',
    authLimiter,
    validate(confirmPasswordResetSchema),
    userCtrl.confirmPasswordReset,
);
