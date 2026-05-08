import { Router, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    adminAuthMiddleware,
    requireAdminRole,
} from '../middleware/adminAuth.middleware';
import { validate } from '../middleware/validate.middleware';
import { HttpMethod, PathParamDef, pushRoute } from './registry';
import type { AdminRole } from '../types';

export interface DefineRouteOptions {
    method: HttpMethod;
    /** Sub-router 내부 경로. 예: '/users/me/password' */
    path: string;
    tag: string;
    summary: string;
    description?: string;
    auth?: boolean;
    /** 어드민(백오피스) 토큰을 강제. auth 와 상호 배타. */
    adminAuth?: boolean;
    /** adminAuth 통과 후 허용할 역할. 비우면 모든 어드민 역할 허용. */
    adminRoles?: AdminRole[];
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
    if (opts.auth && opts.adminAuth) {
        throw new Error('defineRoute: auth 와 adminAuth 는 동시에 사용할 수 없다.');
    }

    const handlers: RequestHandler[] = [];
    if (opts.pre) handlers.push(...opts.pre);
    if (opts.auth) handlers.push(authMiddleware);
    if (opts.adminAuth) {
        handlers.push(adminAuthMiddleware);
        if (opts.adminRoles && opts.adminRoles.length > 0) {
            handlers.push(requireAdminRole(...opts.adminRoles));
        }
    }
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
        auth: (opts.auth ?? false) || (opts.adminAuth ?? false),
        body: opts.body,
        query: opts.query,
        pathParams: opts.pathParams,
        responseExample: opts.responseExample,
    });
}
