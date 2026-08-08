/**
 * H1 회귀 — GET /api/v1/users 의 무인증/타인 PII(이메일 평문) 노출 방지.
 *
 * 배경(H1): 이 라우트는 auth 가 없어 누구나 userId(UUID)만 알면 해당 회원의
 * 평문 email·gender 등을 조회할 수 있었다(PIPA 리스크). 인증을 강제하고
 * 본인(userId===req.user.userId)만 조회하도록 게이팅한다.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../../src/app';
import { query } from '../../../src/config/database';
import { env } from '../../../src/config/env';

const mockQuery = query as jest.MockedFunction<typeof query>;

function userToken(userId: string, email = `${userId}@example.com`): string {
    return jwt.sign({ userId, email, kind: 'user' }, env.JWT_SECRET, { expiresIn: '5m' });
}

const FIXTURE = {
    user_id: 'u1',
    email: 'alice@example.com',
    nickname: 'alice',
    gender: 'F',
    profile_image_url: null,
    user_status: 1,
    user_flag: 0,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-05-01'),
};

beforeEach(() => mockQuery.mockReset());

describe('GET /api/v1/users — H1 (무인증/타인 PII 노출 방지)', () => {
    it('인증 없이 호출하면 401 — DB 조회조차 도달하지 않는다', async () => {
        const res = await request(app).get('/api/v1/users').query({ userId: 'u1' });

        expect(res.status).toBe(401);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('인증됐지만 타인 userId 면 403 — 이메일이 응답에 절대 실리지 않는다', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .query({ userId: 'u2' })
            .set('Authorization', `Bearer ${userToken('u1')}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
        // 타인 행을 SELECT 하기도 전에 차단되어야 한다.
        expect(mockQuery).not.toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });

    it('본인 userId 면 200 + 본인 프로필(이메일 포함)', async () => {
        mockQuery.mockResolvedValueOnce([FIXTURE] as never);

        const res = await request(app)
            .get('/api/v1/users')
            .query({ userId: 'u1' })
            .set('Authorization', `Bearer ${userToken('u1')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.userId).toBe('u1');
        expect(res.body.data.email).toBe('alice@example.com');
    });
});
