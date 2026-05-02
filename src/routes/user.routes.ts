import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as userCtrl from '../controllers/user.controller';
import { defineRoute } from '../openapi/defineRoute';
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
const BASE = '/api/v1';

const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/signup',
    tag: 'Auth',
    summary: '회원가입',
    pre: [authLimiter],
    body: signupSchema,
    handler: userCtrl.signup,
});

defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/login',
    tag: 'Auth',
    summary: '로그인 (Access + Refresh 토큰 발급, httpOnly 쿠키)',
    pre: [authLimiter],
    body: loginSchema,
    handler: userCtrl.login,
});

defineRoute(userRouter, BASE, {
    method: 'get',
    path: '/users',
    tag: 'User',
    summary: '사용자 단건 조회 (userId 쿼리)',
    query: getUserQuerySchema,
    handler: userCtrl.getUser,
});

defineRoute(userRouter, BASE, {
    method: 'patch',
    path: '/users/info',
    tag: 'User',
    summary: '본인 프로필 수정',
    auth: true,
    body: updateUserSchema,
    handler: userCtrl.updateUser,
});

defineRoute(userRouter, BASE, {
    method: 'patch',
    path: '/users/password',
    tag: 'User',
    summary: '본인 비밀번호 변경',
    auth: true,
    body: changePasswordSchema,
    handler: userCtrl.changePassword,
});

// 비밀번호 재설정: 2단계 토큰 흐름 (auth.md)
defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/users/password-reset/request',
    tag: 'Auth',
    summary: '비밀번호 재설정 토큰 요청 (이메일 발송)',
    description: '계정 존재 여부는 응답으로 노출하지 않는다.',
    pre: [authLimiter],
    body: requestPasswordResetSchema,
    handler: userCtrl.requestPasswordReset,
});

defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/users/password-reset/confirm',
    tag: 'Auth',
    summary: '비밀번호 재설정 토큰 검증 + 비밀번호 변경',
    pre: [authLimiter],
    body: confirmPasswordResetSchema,
    handler: userCtrl.confirmPasswordReset,
});
