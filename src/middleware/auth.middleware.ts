import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthRequest, JwtPayload } from '../types';
import { AuthenticationError } from '../utils/errors';
import { setUserId } from '../utils/requestContext';

export function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
        next(new AuthenticationError('인증 토큰이 필요합니다.', 'MISSING_BEARER_TOKEN'));
        return;
    }

    const token = header.slice(7);

    try {
        // algorithms 를 고정한다. 미지정 시 라이브러리가 헤더의 alg 를 따라가므로,
        // 향후 비대칭 키를 도입하면 alg 혼동 공격면이 열린다(현재는 HS256 단일).
        const decoded = jwt.verify(token, env.JWT_SECRET, {
            algorithms: ['HS256'],
        }) as JwtPayload;

        // 토큰 격리: 어드민 access 토큰으로 소비자 보호 라우트를 통과할 수 없게 한다.
        //   - 소비자 토큰 payload 에는 kind 가 없다({userId, email}) → 통과.
        //   - 어드민 토큰은 kind:'admin' → 거부.
        // (역방향은 adminAuthMiddleware 가 kind!=='admin' 을 이미 막는다.)
        if (decoded.kind === 'admin') {
            next(
                new AuthenticationError(
                    '유효하지 않은 토큰입니다.',
                    'INVALID_TOKEN_KIND',
                ),
            );
            return;
        }

        req.user = decoded;
        setUserId(decoded.userId);
        next();
    } catch {
        next(new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_TOKEN'));
    }
}
