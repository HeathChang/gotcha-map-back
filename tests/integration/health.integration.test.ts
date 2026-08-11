/**
 * M2 회귀 — 헬스체크 라우트.
 *  - GET /health       : DB 무관 즉시 200 (liveness).
 *  - GET /health/ready : DB ping 성공 200 / 실패 503 (readiness).
 * rate-limit·CORS 이전에 처리되어야 하고, 인증도 필요 없다.
 */
import request from 'supertest';

jest.mock('../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../src/app';
import { query } from '../../src/config/database';

const mockQuery = query as jest.MockedFunction<typeof query>;

beforeEach(() => mockQuery.mockReset());

describe('GET /health — liveness (M2)', () => {
    it('인증·DB 없이 200 {status:ok}', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        // liveness 는 DB 를 건드리지 않는다.
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('GET /health/ready — readiness (M2)', () => {
    it('DB ping 성공 시 200 {status:ready}', async () => {
        mockQuery.mockResolvedValueOnce([{ '1': 1 }] as never);
        const res = await request(app).get('/health/ready');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ready' });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('DB ping 실패 시 503 {status:unavailable}', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        const res = await request(app).get('/health/ready');
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: 'unavailable' });
    });
});
