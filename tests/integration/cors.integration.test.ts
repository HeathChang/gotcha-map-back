/**
 * CORS 회귀 — 허용되지 않은 출처는 500 이 아니라 CORS 헤더 없는 정상 응답이어야 한다.
 * (cb(new Error()) 로 넘기면 errorMiddleware 가 INTERNAL_ERROR 500 + 스택 로그를 남겨
 *  스캐너 트래픽만으로 에러 로그가 찼다.)
 */
import request from 'supertest';

jest.mock('../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../src/app';
import { query } from '../../src/config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;

// /health 는 CORS 미들웨어보다 앞에 있으므로 CORS 헤더 검증은 /api 하위 공개 라우트로 한다.
beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([] as never);
});

describe('CORS 차단 출처', () => {
    it('허용 목록 밖 Origin 은 500 이 아니며 Access-Control-Allow-Origin 을 내리지 않는다', async () => {
        const res = await request(app)
            .get('/api/v1/banners')
            .set('Origin', 'https://evil.example');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('허용 Origin 은 Access-Control-Allow-Origin 을 그대로 돌려준다', async () => {
        const res = await request(app)
            .get('/api/v1/banners')
            .set('Origin', 'http://localhost:3000');
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
});
