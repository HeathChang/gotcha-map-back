import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';
import { rotateRefresh, revokeRefresh } from '../services/tokens.service';
import { AuthenticationError } from '../utils/errors';
import {
    REFRESH_COOKIE_NAME,
    clearRefreshCookie,
    readCookie,
    setRefreshCookie,
} from '../utils/cookies';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

function getRefreshFromRequest(req: Request): string {
    const fromCookie = readCookie(req, REFRESH_COOKIE_NAME);
    const fromBody = (req.body as { refreshToken?: string })?.refreshToken;
    const token = fromCookie ?? fromBody;
    if (!token || token.length < 16) {
        throw new AuthenticationError('Refresh 토큰이 필요합니다.', 'MISSING_REFRESH_TOKEN');
    }
    return token;
}

function decodeAccessForRefresh(req: Request): JwtPayload {
    // Refresh 시점에 access 토큰은 만료되었을 수 있으므로 verify가 아닌 decode + 만료 무시.
    // 신원은 DB의 refresh_token 레코드(user_id) 와 교차 확인되므로 안전하다.
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        const decoded = jwt.decode(header.slice(7));
        if (decoded && typeof decoded === 'object' && 'userId' in decoded && 'email' in decoded) {
            return decoded as JwtPayload;
        }
    }
    const body = (req.body as { userId?: string; email?: string }) ?? {};
    if (body.userId && body.email) {
        return { userId: body.userId, email: body.email };
    }
    throw new AuthenticationError(
        '사용자 식별 정보가 필요합니다.',
        'MISSING_IDENTITY_HINT',
    );
}

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawRefresh = getRefreshFromRequest(req);
    const payload = decodeAccessForRefresh(req);
    void env; // ensure env is loaded for downstream

    const tokens = await rotateRefresh(rawRefresh, payload, {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    });

    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    success(res, {
        accessToken: tokens.accessToken,
        accessExpiresInSec: tokens.accessExpiresInSec,
        refreshExpiresAt: tokens.refreshExpiresAt,
    });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    const fromCookie = readCookie(req, REFRESH_COOKIE_NAME);
    const fromBody = (req.body as { refreshToken?: string })?.refreshToken;
    const token = fromCookie ?? fromBody;
    if (token) {
        await revokeRefresh(token);
    }
    clearRefreshCookie(res);
    success(res, null, '로그아웃되었습니다.');
});
