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
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        req.user = decoded;
        setUserId(decoded.userId);
        next();
    } catch {
        next(new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_TOKEN'));
    }
}
