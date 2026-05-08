import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    getAdminProfile,
    loginAdmin,
    logoutAdmin,
} from '../services/admin.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import {
    REFRESH_COOKIE_NAME,
    clearRefreshCookie,
    readCookie,
    setRefreshCookie,
} from '../utils/cookies';
import type { AdminLoginInput } from '../validators/admin.schema';

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as AdminLoginInput;

    const result = await loginAdmin(email, password, {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    });

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    success(res, {
        user: result.user,
        accessToken: result.accessToken,
        accessExpiresInSec: result.accessExpiresInSec,
        refreshToken: result.refreshToken,
        refreshExpiresAt: result.refreshExpiresAt,
    });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    const fromCookie = readCookie(req, REFRESH_COOKIE_NAME);
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    await logoutAdmin(fromCookie ?? fromBody);
    clearRefreshCookie(res);
    success(res, null, '로그아웃되었습니다.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AdminAuthRequest;
    const profile = await getAdminProfile(user.userId);
    success(res, profile);
});
