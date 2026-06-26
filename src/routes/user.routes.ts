import { Request, Response, Router } from 'express';
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
    summary: '본인 프로필 수정 (PATCH 권장)',
    auth: true,
    body: updateUserSchema,
    handler: userCtrl.updateUser,
});

// FE v1 호환: 같은 경로 POST 도 수용. v2에서 PATCH 만 유지 예정.
defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/users/info',
    tag: 'User',
    summary: '본인 프로필 수정 (FE v1 호환 — POST)',
    auth: true,
    body: updateUserSchema,
    handler: userCtrl.updateUser,
});

defineRoute(userRouter, BASE, {
    method: 'patch',
    path: '/users/password',
    tag: 'User',
    summary: '본인 비밀번호 변경 (PATCH 권장)',
    auth: true,
    body: changePasswordSchema,
    handler: userCtrl.changePassword,
});

// FE v1 호환: 같은 경로 POST 도 수용. v2에서 PATCH 만 유지 예정.
defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/users/password',
    tag: 'User',
    summary: '본인 비밀번호 변경 (FE v1 호환 — POST)',
    auth: true,
    body: changePasswordSchema,
    handler: userCtrl.changePassword,
});

// 회원탈퇴 — soft delete(user_status=-1). 본인만(auth). FE 호환 위해 POST 사용(body 없음).
defineRoute(userRouter, BASE, {
    method: 'post',
    path: '/users/withdraw',
    tag: 'User',
    summary: '회원탈퇴 (soft-delete: user_status=-1, 보유 refresh 토큰 전체 무효화)',
    auth: true,
    handler: userCtrl.withdrawUser,
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

// 구 비밀번호 재설정 엔드포인트는 보안 결함(userId+email만으로 변경 가능)으로 제거됨.
// FE 호환을 위해 410 Gone + 마이그레이션 안내를 응답한다.
userRouter.post('/users/reset-password', (_req: Request, res: Response) => {
    res.status(410).json({
        code: 'ENDPOINT_GONE',
        message:
            '이 엔드포인트는 보안상 제거되었습니다. /users/password-reset/request 와 /users/password-reset/confirm 을 사용하세요.',
        details: [
            { step: 1, method: 'POST', path: '/api/v1/users/password-reset/request', body: { email: 'string' } },
            {
                step: 2,
                method: 'POST',
                path: '/api/v1/users/password-reset/confirm',
                body: { token: 'string', newPassword: 'string' },
            },
        ],
    });
});
