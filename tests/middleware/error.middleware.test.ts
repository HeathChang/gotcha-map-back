import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorMiddleware, notFoundMiddleware } from '../../src/middleware/error.middleware';
import { NotFoundError, ValidationError } from '../../src/utils/errors';

function buildApp(handler: (req: Request, res: Response, next: NextFunction) => unknown) {
    const app = express();
    app.use(express.json());
    app.get('/t', handler);
    app.use(notFoundMiddleware);
    app.use(errorMiddleware);
    return app;
}

describe('errorMiddleware', () => {
    it('DomainError는 상태 + code + message를 반환', async () => {
        const app = buildApp((_req, _res, next) => next(new NotFoundError('없음', 'X_NOT_FOUND')));
        const res = await request(app).get('/t');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ code: 'X_NOT_FOUND', message: '없음' });
    });

    it('DomainError의 details가 있으면 응답에 포함', async () => {
        const app = buildApp((_req, _res, next) =>
            next(new ValidationError('검증', 'BAD', [{ field: 'x' }])),
        );
        const res = await request(app).get('/t');
        expect(res.status).toBe(400);
        expect(res.body.details).toEqual([{ field: 'x' }]);
    });

    it('ZodError는 400 + VALIDATION_ERROR code', async () => {
        const app = buildApp((_req, _res, next) => {
            const parsed = z.object({ a: z.string() }).safeParse({});
            if (!parsed.success) next(parsed.error);
        });
        const res = await request(app).get('/t');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('예상 불가 에러는 500 + INTERNAL_ERROR', async () => {
        const app = buildApp((_req, _res, next) => next(new Error('boom')));
        const res = await request(app).get('/t');
        expect(res.status).toBe(500);
        expect(res.body.code).toBe('INTERNAL_ERROR');
        expect(res.body).not.toHaveProperty('stack');
    });

    it('notFoundMiddleware는 ROUTE_NOT_FOUND', async () => {
        const app = buildApp((_req, _res, next) => next());
        const res = await request(app).get('/missing');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('ROUTE_NOT_FOUND');
    });
});
