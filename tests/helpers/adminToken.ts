import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import type { AdminRole, JwtPayload } from '../../src/types';

/**
 * 어드민 통합 테스트에서 Authorization 헤더에 실을 JWT 를 만든다.
 * member 의 소유권 가드 테스트를 위해 storeId 를 실을 수 있다.
 */
export function adminToken(
    role: AdminRole,
    adminId: string = 'admin-test',
    storeId?: string,
): string {
    const payload: JwtPayload = {
        userId: adminId,
        email: `${role}@gachamap.io`,
        kind: 'admin',
        role,
    };
    if (storeId !== undefined) payload.storeId = storeId;
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '5m' });
}
