import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authCtrl from '../controllers/auth.controller';
import { defineRoute } from '../openapi/defineRoute';
import { env } from '../config/env';

export const authRouter = Router();
const BASE = '/api/v1/auth';

const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        code: 'TOO_MANY_REQUESTS',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    },
});

defineRoute(authRouter, BASE, {
    method: 'post',
    path: '/refresh',
    tag: 'Auth',
    summary: 'Refresh 토큰 회전 (httpOnly 쿠키 또는 body)',
    description:
        'Refresh 토큰은 1회용. 정상 회전 시 새 access + refresh 발급. 재사용 감지 시 family 전체 무효화.',
    pre: [authLimiter],
    handler: authCtrl.refresh,
});

defineRoute(authRouter, BASE, {
    method: 'post',
    path: '/logout',
    tag: 'Auth',
    summary: '로그아웃 — refresh 토큰 family 전체 무효화 + 쿠키 제거',
    pre: [authLimiter],
    handler: authCtrl.logout,
});
