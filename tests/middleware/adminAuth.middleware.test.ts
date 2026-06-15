import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
    adminAuthMiddleware,
    requireAdminRole,
    requireStoreOwnership,
} from '../../src/middleware/adminAuth.middleware';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { env } from '../../src/config/env';
import type { AdminAuthRequest, AdminRole, JwtPayload } from '../../src/types';

function buildAdminApp(roles?: AdminRole[]) {
    const app = express();
    app.use(express.json());
    const handlers = [adminAuthMiddleware];
    if (roles) handlers.push(requireAdminRole(...roles));
    app.get(
        '/secure',
        ...handlers,
        (req: Request, res: Response) => {
            const { user } = req as AdminAuthRequest;
            res.json({ data: { adminId: user.userId, role: user.role } });
        },
    );
    app.use(errorMiddleware);
    return app;
}

function sign(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '5m' });
}

describe('adminAuthMiddleware', () => {
    it('Bearer 토큰이 없으면 401 + MISSING_BEARER_TOKEN', async () => {
        const res = await request(buildAdminApp()).get('/secure');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('MISSING_BEARER_TOKEN');
    });

    it('서명이 잘못된 토큰은 401 + INVALID_TOKEN', async () => {
        const res = await request(buildAdminApp())
            .get('/secure')
            .set('Authorization', 'Bearer not-a-jwt');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('일반 user 토큰(kind 없음)은 403 + ADMIN_TOKEN_REQUIRED', async () => {
        const token = sign({ userId: 'user-1', email: 'u@x.com' });
        const res = await request(buildAdminApp())
            .get('/secure')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_TOKEN_REQUIRED');
    });

    it('admin 토큰은 통과시키고 req.user 에 role 을 주입한다', async () => {
        const token = sign({
            userId: 'admin-1',
            email: 'ops@gachamap.io',
            kind: 'admin',
            role: 'admin',
        });
        const res = await request(buildAdminApp())
            .get('/secure')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ adminId: 'admin-1', role: 'admin' });
    });
});

describe('requireAdminRole', () => {
    it('허용 역할 외에는 403 + ADMIN_ROLE_FORBIDDEN', async () => {
        const token = sign({
            userId: 'admin-2',
            email: 'member@gachamap.io',
            kind: 'admin',
            role: 'member',
        });
        const res = await request(buildAdminApp(['admin', 'staff']))
            .get('/secure')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_ROLE_FORBIDDEN');
    });

    it('허용 역할이면 200 으로 통과', async () => {
        const token = sign({
            userId: 'admin-3',
            email: 'cs@gachamap.io',
            kind: 'admin',
            role: 'staff',
        });
        const res = await request(buildAdminApp(['admin', 'staff']))
            .get('/secure')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.role).toBe('staff');
    });
});

describe('requireStoreOwnership', () => {
    function buildOwnershipApp() {
        const app = express();
        app.get(
            '/stores/:storeId/x',
            adminAuthMiddleware,
            requireStoreOwnership(),
            (_req: Request, res: Response) => res.json({ data: 'ok' }),
        );
        app.use(errorMiddleware);
        return app;
    }

    it('admin 은 임의 매장 통과 (전 매장 권한)', async () => {
        const token = sign({ userId: 'a', email: 'a@x.com', kind: 'admin', role: 'admin' });
        const res = await request(buildOwnershipApp())
            .get('/stores/any-store/x')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('member 는 자기 매장(storeId 일치) 통과', async () => {
        const token = sign({
            userId: 'm', email: 'm@x.com', kind: 'admin', role: 'member', storeId: 's1',
        });
        const res = await request(buildOwnershipApp())
            .get('/stores/s1/x')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('member 가 타 매장 접근 시 403 + STORE_OWNERSHIP_FORBIDDEN', async () => {
        const token = sign({
            userId: 'm', email: 'm@x.com', kind: 'admin', role: 'member', storeId: 's1',
        });
        const res = await request(buildOwnershipApp())
            .get('/stores/s2/x')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('STORE_OWNERSHIP_FORBIDDEN');
    });

    it('배정 매장 없는 member 는 403 + NO_ASSIGNED_STORE', async () => {
        const token = sign({ userId: 'm', email: 'm@x.com', kind: 'admin', role: 'member' });
        const res = await request(buildOwnershipApp())
            .get('/stores/s1/x')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('NO_ASSIGNED_STORE');
    });
});
