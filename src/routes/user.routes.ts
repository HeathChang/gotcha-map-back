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
    resetPasswordSchema,
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

userRouter.post(
    '/users/reset-password',
    authLimiter,
    validate(resetPasswordSchema),
    userCtrl.resetPassword,
);
