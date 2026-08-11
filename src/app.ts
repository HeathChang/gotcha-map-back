import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { query } from './config/database';
import { router } from './routes';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { requestContextMiddleware } from './middleware/requestContext.middleware';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// M2: 헬스체크 — 로드밸런서/Railway healthcheckPath 용. rate-limit·CORS·body-parser 이전에 처리.
//   - /health       : liveness (프로세스 생존만, DB 무관 즉시 200 — DB 지연에 플랩 안 함)
//   - /health/ready : readiness (DB ping 성공 시 200, 실패 시 503)
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.get('/health/ready', async (_req, res) => {
    try {
        await query('SELECT 1');
        res.status(200).json({ status: 'ready' });
    } catch {
        res.status(503).json({ status: 'unavailable' });
    }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(requestContextMiddleware);

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (env.CORS_ORIGIN.includes(origin)) return cb(null, true);
            return cb(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
    }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', globalLimiter);

app.use('/uploads', express.static('uploads'));

app.use('/api/v1', router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
