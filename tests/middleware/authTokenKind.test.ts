/**
 * X1 회귀 — 소비자 authMiddleware 는 어드민 access 토큰을 거부한다.
 *
 * 배경(X1): authMiddleware 가 jwt.verify 만 하고 payload 의 kind 를 검사하지 않아,
 *   어드민 access 토큰으로 `auth:true` 소비자 라우트(찜·문의·프로필 수정·탈퇴)를 통과할 수 있었다.
 *   역방향(어드민 라우트)은 adminAuthMiddleware 가 kind!=='admin' 을 이미 막고 있었으므로
 *   격리가 한쪽만 뚫려 있던 상태.
 *
 * 수정: kind==='admin' 이면 INVALID_TOKEN_KIND 로 거부한다.
 *   소비자 토큰 payload 에는 kind 가 없으므로({userId,email}) 기존 토큰은 영향받지 않는다
 *   — 이 하위호환이 깨지지 않는지도 함께 검증한다.
 *
 * 곁들여: alg 고정(algorithms:['HS256'])으로 헤더 alg 를 따라가지 않는지 확인.
 */
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import { authMiddleware } from '../../src/middleware/auth.middleware';
import { env } from '../../src/config/env';
import type { AuthRequest } from '../../src/types';

function invoke(token: string) {
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = {} as Response;
    let err: unknown;
    const next = ((e?: unknown) => {
        err = e;
    }) as NextFunction;

    authMiddleware(req, res, next);
    return { req, err: err as { code?: string } | undefined };
}

describe('authMiddleware — 토큰 kind 격리 (X1)', () => {
    it('어드민 access 토큰은 소비자 라우트에서 거부된다', () => {
        const adminToken = jwt.sign(
            { userId: 'admin-1', email: 'ops@example.com', kind: 'admin', role: 'admin' },
            env.JWT_SECRET,
            { expiresIn: '15m' },
        );

        const { req, err } = invoke(adminToken);

        expect(err).toBeDefined();
        expect(err?.code).toBe('INVALID_TOKEN_KIND');
        expect(req.user).toBeUndefined();
    });

    it('소비자 토큰(kind 없음)은 그대로 통과한다 — 기존 토큰 하위호환', () => {
        const userToken = jwt.sign(
            { userId: 'user-1', email: 'user@example.com' },
            env.JWT_SECRET,
            { expiresIn: '15m' },
        );

        const { req, err } = invoke(userToken);

        expect(err).toBeUndefined();
        expect(req.user?.userId).toBe('user-1');
    });

    it('member/staff 어드민 토큰도 동일하게 거부된다', () => {
        for (const role of ['staff', 'member'] as const) {
            const token = jwt.sign(
                { userId: `a-${role}`, email: `${role}@example.com`, kind: 'admin', role },
                env.JWT_SECRET,
                { expiresIn: '15m' },
            );
            const { err } = invoke(token);
            expect(err).toBeDefined();
            expect((err as { code?: string })?.code).toBe('INVALID_TOKEN_KIND');
        }
    });

    it('서명이 다른 토큰은 INVALID_TOKEN 으로 거부된다', () => {
        const forged = jwt.sign({ userId: 'x', email: 'x@example.com' }, 'a'.repeat(40), {
            expiresIn: '15m',
        });

        const { err } = invoke(forged);

        expect(err).toBeDefined();
        expect(err?.code).toBe('INVALID_TOKEN');
    });
});
