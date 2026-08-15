import { Request, Response } from 'express';
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

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const rawRefresh = getRefreshFromRequest(req);

    // 신원은 rotateRefresh 가 refresh_token 레코드의 user_id 로 DB 를 재조회해 결정한다.
    // client 가 Authorization 으로 보낸 access 는 신뢰하지 않는다(C1 권한상승 차단).
    const tokens = await rotateRefresh(rawRefresh, {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    });

    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
    // login과 동일한 정책: web 은 쿠키 사용, native 는 body의 refreshToken을 secure storage 에 저장.
    success(res, {
        accessToken: tokens.accessToken,
        accessExpiresInSec: tokens.accessExpiresInSec,
        refreshToken: tokens.refreshToken,
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
