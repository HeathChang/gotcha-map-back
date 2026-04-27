import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler<Req extends Request = Request> = (
    req: Req,
    res: Response,
    next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(fn: AsyncHandler<Req>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req as Req, res, next)).catch(next);
    };
}
