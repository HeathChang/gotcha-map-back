import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    getAdminProfile,
    loginAdmin,
    logoutAdmin,
} from '../services/admin.service';
import { rotateAdminRefresh } from '../services/adminTokens.service';
import { AuthenticationError } from '../utils/errors';
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

function getRefreshFromRequest(req: Request): string {
    const fromCookie = readCookie(req, REFRESH_COOKIE_NAME);
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const token = fromCookie ?? fromBody;
    if (!token || token.length < 16) {
        throw new AuthenticationError(
            'Refresh 토큰이 필요합니다.',
            'MISSING_REFRESH_TOKEN',
        );
    }
    return token;
}

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawRefresh = getRefreshFromRequest(req);

    // 신원(role/storeId 포함)은 rotateAdminRefresh 가 admin_refresh_tokens 레코드의
    // admin_id 로 admin_users 를 재조회해 결정한다. client access 는 신뢰하지 않는다(C1).
    const tokens = await rotateAdminRefresh(rawRefresh, {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    });

    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    success(res, {
        accessToken: tokens.accessToken,
        accessExpiresInSec: tokens.accessExpiresInSec,
        refreshToken: tokens.refreshToken,
        refreshExpiresAt: tokens.refreshExpiresAt,
    });
});
