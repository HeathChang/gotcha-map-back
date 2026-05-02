import { Router, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { HttpMethod, PathParamDef, pushRoute } from './registry';

export interface DefineRouteOptions {
    method: HttpMethod;
    /** Sub-router 내부 경로. 예: '/users/me/password' */
    path: string;
    tag: string;
    summary: string;
    description?: string;
    auth?: boolean;
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    pathParams?: PathParamDef[];
    /** 인증/검증 이전에 적용할 미들웨어 (rate limit, multer 등) */
    pre?: RequestHandler[];
    handler: RequestHandler;
    responseExample?: unknown;
}

/**
 * Express Router 와 OpenAPI 레지스트리에 동시에 등록한다.
 * Postman/문서가 항상 실제 라우트와 동기화되도록 단일 진입점 역할을 한다.
 */
export function defineRoute(
    router: Router,
    basePath: string,
    opts: DefineRouteOptions,
): void {
    const handlers: RequestHandler[] = [];
    if (opts.pre) handlers.push(...opts.pre);
    if (opts.auth) handlers.push(authMiddleware);
    if (opts.query) handlers.push(validate(opts.query, 'query'));
    if (opts.body) handlers.push(validate(opts.body, 'body'));
    handlers.push(opts.handler);

    router[opts.method](opts.path, ...handlers);

    pushRoute({
        method: opts.method,
        path: opts.path,
        basePath,
        tag: opts.tag,
        summary: opts.summary,
        description: opts.description,
        auth: opts.auth ?? false,
        body: opts.body,
        query: opts.query,
        pathParams: opts.pathParams,
        responseExample: opts.responseExample,
    });
}
