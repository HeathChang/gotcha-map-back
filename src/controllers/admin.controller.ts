import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AdminAuthRequest, JwtPayload } from '../types';
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

/**
 * Refresh 시점에 access 토큰은 만료되었을 수 있으므로 verify 가 아닌 decode + 만료 무시.
 * 신원은 admin_refresh_tokens 레코드(admin_id) 와 교차 확인되므로 안전하다.
 * payload.kind 가 'admin' 이 아니면 rotateAdminRefresh 가 거부한다.
 */
function decodeAccessForAdminRefresh(req: Request): JwtPayload {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        const decoded = jwt.decode(header.slice(7));
        if (
            decoded &&
            typeof decoded === 'object' &&
            'userId' in decoded &&
            'email' in decoded
        ) {
            const payload = decoded as JwtPayload;
            if (payload.kind === 'admin') return payload;
        }
    }
    throw new AuthenticationError(
        '어드민 인증 정보가 필요합니다.',
        'MISSING_ADMIN_IDENTITY',
    );
}

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawRefresh = getRefreshFromRequest(req);
    const payload = decodeAccessForAdminRefresh(req);

    const tokens = await rotateAdminRefresh(rawRefresh, payload, {
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
