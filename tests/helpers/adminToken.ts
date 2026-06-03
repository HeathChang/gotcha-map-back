import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import type { AdminRole, JwtPayload } from '../../src/types';

/** 어드민 통합 테스트에서 Authorization 헤더에 실을 JWT 를 만든다. */
export function adminToken(role: AdminRole, adminId: string = 'admin-test'): string {
    const payload: JwtPayload = {
        userId: adminId,
        email: `${role}@gachamap.io`,
        kind: 'admin',
        role,
    };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '5m' });
}
