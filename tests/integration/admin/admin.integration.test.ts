/**
 * Admin 로그인 / me / logout — 인증 진입점 통합.
 * 로그인은 bcrypt + 토큰 발급 + refresh 저장으로 흐름이 길어, 핵심 분기만 검증.
 */
import request from 'supertest';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import bcrypt from 'bcrypt';
import app from '../../../src/app';
import { query } from '../../../src/config/database';
import { adminToken } from '../../helpers/adminToken';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('POST /api/v1/admin/login', () => {
    it('알 수 없는 이메일은 401 + INVALID_ADMIN_CREDENTIALS', async () => {
        mockQuery.mockResolvedValueOnce([] as never);

        const res = await request(app)
            .post('/api/v1/admin/login')
            .send({ email: 'unknown@x.com', password: 'whatever' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_ADMIN_CREDENTIALS');
    });

    it('비밀번호 불일치는 401 + INVALID_ADMIN_CREDENTIALS', async () => {
        const hashed = await bcrypt.hash('correct-pw', 4);
        mockQuery.mockResolvedValueOnce([
            {
                admin_id: 'a1',
                email: 'ops@gachamap.io',
                password: hashed,
                name: '운영자',
                role: 'admin',
                admin_status: 1,
                created_at: new Date(),
                updated_at: new Date(),
            },
        ] as never);

        const res = await request(app)
            .post('/api/v1/admin/login')
            .send({ email: 'ops@gachamap.io', password: 'wrong-pw' });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('INVALID_ADMIN_CREDENTIALS');
    });

    it('이메일 형식 위반은 400 (zod)', async () => {
        const res = await request(app)
            .post('/api/v1/admin/login')
            .send({ email: 'not-an-email', password: 'x' });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/v1/admin/me', () => {
    it('인증 없으면 401', async () => {
        const res = await request(app).get('/api/v1/admin/me');
        expect(res.status).toBe(401);
    });

    it('admin 토큰 → 프로필 응답', async () => {
        mockQuery.mockResolvedValueOnce([
            {
                admin_id: 'admin-test',
                email: 'ops@gachamap.io',
                name: '운영자',
                role: 'admin',
                admin_status: 1,
                created_at: new Date('2026-01-01'),
                updated_at: new Date('2026-01-01'),
            },
        ] as never);

        const res = await request(app)
            .get('/api/v1/admin/me')
            .set('Authorization', `Bearer ${adminToken('admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            adminId: 'admin-test',
            email: 'ops@gachamap.io',
            role: 'admin',
        });
    });

    it('일반 user 토큰(kind 미지정)은 403 — admin 라우트 진입 차단', async () => {
        // 일반 사용자용 토큰을 만들기 위해 직접 jwt 사인
        const jwt = await import('jsonwebtoken');
        const { env } = await import('../../../src/config/env');
        const userTok = jwt.sign(
            { userId: 'u1', email: 'u@x.com' },
            env.JWT_SECRET,
            { expiresIn: '5m' },
        );
        const res = await request(app)
            .get('/api/v1/admin/me')
            .set('Authorization', `Bearer ${userTok}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_TOKEN_REQUIRED');
    });
});
