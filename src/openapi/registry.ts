import type { ZodTypeAny } from 'zod';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface PathParamDef {
    name: string;
    description?: string;
    example?: string;
}

export interface RouteDefinition {
    method: HttpMethod;
    /** Sub-router 내부 경로 (예: '/users/me/password') */
    path: string;
    /** 부모 마운트 경로 (예: '/api/v1/products'). app.ts 마운트와 일치해야 한다. */
    basePath: string;
    tag: string;
    summary: string;
    description?: string;
    auth: boolean;
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    pathParams?: PathParamDef[];
    /** 명시적 응답 예시 (선택). 미지정 시 generator는 생략한다. */
    responseExample?: unknown;
}

export const ROUTE_REGISTRY: RouteDefinition[] = [];

export function pushRoute(def: RouteDefinition): void {
    ROUTE_REGISTRY.push(def);
}

export function clearRegistryForTests(): void {
    ROUTE_REGISTRY.length = 0;
}
