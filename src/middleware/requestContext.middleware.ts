import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithContext } from '../utils/requestContext';
import { logger } from '../utils/logger';

const TRACE_HEADER = 'x-trace-id';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(TRACE_HEADER);
    const traceId = incoming && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader(TRACE_HEADER, traceId);

    runWithContext({ traceId }, () => {
        const start = Date.now();
        res.on('finish', () => {
            logger.info('http.request', {
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                durationMs: Date.now() - start,
            });
        });
        next();
    });
}
