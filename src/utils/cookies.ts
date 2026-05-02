import { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

export const REFRESH_COOKIE_NAME = 'gm_refresh';

export function readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const [rawKey, ...rawVal] = part.split('=');
        if (rawKey?.trim() === name) {
            return decodeURIComponent(rawVal.join('=').trim());
        }
    }
    return undefined;
}

function refreshCookieOptions(expiresAt: Date): CookieOptions {
    return {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        path: '/api/v1/auth',
        expires: expiresAt,
    };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(expiresAt));
}

export function clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAMESITE,
        domain: env.COOKIE_DOMAIN,
        path: '/api/v1/auth',
    });
}
