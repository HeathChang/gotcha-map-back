import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AdminAuthRequest, AdminRole, JwtPayload } from '../types';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { setUserId } from '../utils/requestContext';

/**
 * 어드민 토큰 검증 미들웨어.
 *  - JWT 서명/만료 검증
 *  - payload.kind === 'admin' 강제 (일반 user 토큰 거부)
 *  - payload.role 이 어드민 역할 셋에 포함되어야 함
 *  - 통과 시 req.user 에 정형화된 어드민 payload 를 주입
 *
 * 컨트롤러는 req 를 AdminAuthRequest 로 단언해 user 필드에 안전하게 접근한다.
 */
export function adminAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
): void {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
        next(new AuthenticationError('인증 토큰이 필요합니다.', 'MISSING_BEARER_TOKEN'));
        return;
    }

    const token = header.slice(7);
    let decoded: JwtPayload;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
        next(new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_TOKEN'));
        return;
    }

    if (decoded.kind !== 'admin' || !decoded.role) {
        next(new AuthorizationError('어드민 권한이 필요합니다.', 'ADMIN_TOKEN_REQUIRED'));
        return;
    }

    (req as AdminAuthRequest).user = {
        userId: decoded.userId,
        email: decoded.email,
        kind: 'admin',
        role: decoded.role,
        // member 의 담당 매장 (admin/staff 는 null). requireStoreOwnership 가 사용.
        storeId: decoded.storeId ?? null,
    };
    setUserId(decoded.userId);
    next();
}

/** 특정 역할만 허용. adminAuthMiddleware 뒤에 체이닝한다. */
export function requireAdminRole(...allowed: AdminRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const user = (req as AdminAuthRequest).user;
        if (!user || !allowed.includes(user.role)) {
            next(new AuthorizationError('이 작업에 대한 권한이 없습니다.', 'ADMIN_ROLE_FORBIDDEN'));
            return;
        }
        next();
    };
}

/**
 * 매장 소유권 검사 (gotcha-map-policy §3 — 행 단위 권한). requireAdminRole 뒤에 체이닝한다.
 *  - admin / staff: 전 매장 권한 → 항상 통과.
 *  - member: 담당 매장(req.user.storeId)이 있어야 하고, 대상 store 가 그 매장일 때만 통과.
 * extractStoreId 로 요청에서 대상 store id 를 뽑는다 (기본: req.params.storeId).
 * 대상 store id 가 없으면(예: 자기 매장 전용 핸들러) member 라도 통과시키고, 핸들러가
 * req.user.storeId 를 직접 사용하도록 한다.
 */
export function requireStoreOwnership(
    extractStoreId: (req: Request) => string | undefined = (req) =>
        typeof req.params.storeId === 'string' ? req.params.storeId : undefined,
) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const user = (req as AdminAuthRequest).user;
        if (!user) {
            next(new AuthenticationError('인증이 필요합니다.', 'ADMIN_TOKEN_REQUIRED'));
            return;
        }
        if (user.role !== 'member') {
            next();
            return;
        }
        if (!user.storeId) {
            next(new AuthorizationError('배정된 매장이 없습니다.', 'NO_ASSIGNED_STORE'));
            return;
        }
        const targetStoreId = extractStoreId(req);
        if (targetStoreId !== undefined && targetStoreId !== user.storeId) {
            next(
                new AuthorizationError(
                    '자기 매장에 대해서만 작업할 수 있습니다.',
                    'STORE_OWNERSHIP_FORBIDDEN',
                ),
            );
            return;
        }
        next();
    };
}
