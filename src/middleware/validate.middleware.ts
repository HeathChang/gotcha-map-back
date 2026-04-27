import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body'): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            next(result.error);
            return;
        }
        // Assign parsed (coerced/defaulted) values back
        (req as unknown as Record<string, unknown>)[source] = result.data;
        next();
    };
}
