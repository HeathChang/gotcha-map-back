import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { DomainError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ErrorResponseBody {
    code: string;
    message: string;
    details?: unknown;
}

function zodToDetails(err: ZodError): Array<{ field: string; reason: string }> {
    return err.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        reason: issue.message,
    }));
}

export function errorMiddleware(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof ZodError) {
        const body: ErrorResponseBody = {
            code: 'VALIDATION_ERROR',
            message: '요청 데이터가 올바르지 않습니다.',
            details: zodToDetails(err),
        };
        res.status(400).json(body);
        return;
    }

    if (err instanceof DomainError) {
        const body: ErrorResponseBody = {
            code: err.code,
            message: err.message,
        };
        if (err.details && err.details.length > 0) body.details = err.details;
        res.status(err.status).json(body);
        return;
    }

    if (err instanceof multer.MulterError) {
        res.status(400).json({
            code: `UPLOAD_${err.code}`,
            message: err.message,
        } satisfies ErrorResponseBody);
        return;
    }

    const error = err as Error;
    logger.error('unhandled error', {
        method: req.method,
        url: req.originalUrl,
        err: { message: error?.message, stack: error?.stack },
    });

    res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다.',
    } satisfies ErrorResponseBody);
}

export function notFoundMiddleware(_req: Request, res: Response): void {
    res.status(404).json({
        code: 'ROUTE_NOT_FOUND',
        message: '요청한 리소스를 찾을 수 없습니다.',
    } satisfies ErrorResponseBody);
}
