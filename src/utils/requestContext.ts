import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
    traceId: string;
    userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
    return storage.getStore();
}

export function setUserId(userId: string): void {
    const ctx = storage.getStore();
    if (ctx) ctx.userId = userId;
}
