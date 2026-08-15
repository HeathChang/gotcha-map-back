/**
 * 어드민 토큰 발급/회전/철회.
 *
 * tokens.service.ts 와 동일한 패턴이지만 테이블만 admin_refresh_tokens 로 바뀌었다.
 *  - access 토큰은 동일한 JWT_SECRET 으로 서명. payload.kind='admin' 으로 일반 user 토큰과 구분.
 *  - refresh 토큰은 admin_users(admin_id) FK 로 묶인 별도 테이블에 저장.
 *  - 1회용 + family rotation + 재사용 감지 — auth.md 와 동일한 정책.
 */
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { env } from '../config/env';
import { AdminRole, JwtPayload } from '../types';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AdminIssuedTokens {
    accessToken: string;
    accessExpiresInSec: number;
    refreshToken: string;
    refreshExpiresAt: Date;
}

interface RefreshContext {
    userAgent?: string;
    ip?: string;
}

interface AdminRefreshRow {
    token_id: string;
    admin_id: string;
    family_id: string;
    parent_id: string | null;
    expires_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function signAdminAccessToken(payload: JwtPayload): {
    token: string;
    expiresInSec: number;
} {
    const ttl = env.ACCESS_TOKEN_TTL as string & jwt.SignOptions['expiresIn'];
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: ttl });
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresInSec = decoded?.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 900;
    return { token, expiresInSec };
}

function generateRawRefresh(): string {
    return randomBytes(48).toString('base64url');
}

async function persistAdminRefresh(params: {
    adminId: string;
    familyId: string;
    parentId: string | null;
    rawToken: string;
    ctx: RefreshContext;
}): Promise<{ tokenId: string; expiresAt: Date }> {
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await query(
        `INSERT INTO admin_refresh_tokens
            (token_id, admin_id, token_hash, family_id, parent_id, user_agent, ip, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            tokenId,
            params.adminId,
            hashToken(params.rawToken),
            params.familyId,
            params.parentId,
            params.ctx.userAgent ?? null,
            params.ctx.ip ?? null,
            expiresAt,
        ],
    );
    return { tokenId, expiresAt };
}

export async function issueAdminTokens(
    payload: JwtPayload,
    ctx: RefreshContext = {},
): Promise<AdminIssuedTokens> {
    if (payload.kind !== 'admin') {
        throw new Error('issueAdminTokens: payload.kind must be "admin"');
    }

    const access = signAdminAccessToken(payload);
    const rawRefresh = generateRawRefresh();
    const familyId = uuidv4();
    const persisted = await persistAdminRefresh({
        adminId: payload.userId,
        familyId,
        parentId: null,
        rawToken: rawRefresh,
        ctx,
    });

    return {
        accessToken: access.token,
        accessExpiresInSec: access.expiresInSec,
        refreshToken: rawRefresh,
        refreshExpiresAt: persisted.expiresAt,
    };
}

async function revokeAdminFamily(
    familyId: string,
    reason: string,
): Promise<void> {
    await query(
        `UPDATE admin_refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE family_id = ? AND revoked_at IS NULL`,
        [familyId],
    );
    logger.warn('admin_refresh_token.family_revoked', { familyId, reason });
}

export async function rotateAdminRefresh(
    rawRefresh: string,
    ctx: RefreshContext = {},
): Promise<AdminIssuedTokens> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await query<AdminRefreshRow[]>(
        `SELECT token_id, admin_id, family_id, parent_id, expires_at, used_at, revoked_at
         FROM admin_refresh_tokens WHERE token_hash = ?`,
        [tokenHash],
    );
    const record = rows[0];

    if (!record) {
        throw new AuthenticationError(
            '유효하지 않은 토큰입니다.',
            'INVALID_REFRESH_TOKEN',
        );
    }

    if (record.revoked_at !== null) {
        throw new AuthenticationError(
            '철회된 토큰입니다.',
            'REVOKED_REFRESH_TOKEN',
        );
    }

    if (record.used_at !== null) {
        await revokeAdminFamily(record.family_id, 'admin_refresh_token_reuse_detected');
        throw new AuthenticationError(
            '재사용이 감지되어 세션이 무효화되었습니다. 다시 로그인하세요.',
            'REFRESH_TOKEN_REUSE',
        );
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
        throw new AuthenticationError('만료된 토큰입니다.', 'EXPIRED_REFRESH_TOKEN');
    }

    // 신원(role/storeId 포함)은 admin_refresh_tokens 레코드의 admin_id 로 admin_users 를
    // 재조회해 재구성한다. client access(Authorization) 의 role/kind 는 신뢰하지 않는다 —
    // 위조 role 로 상위 권한을 발급받는 권한상승(C1)을 차단한다.
    const identityRows = await query<
        Array<{
            admin_id: string;
            email: string;
            role: AdminRole;
            store_id: string | null;
        }>
    >(
        `SELECT admin_id, email, role, store_id
         FROM admin_users WHERE admin_id = ? AND admin_status = 1`,
        [record.admin_id],
    );
    const identity = identityRows[0];
    if (!identity) {
        // 비활성 관리자는 회전을 거부한다 (H1 refresh 벡터 동시 차단).
        throw new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_REFRESH_TOKEN');
    }
    const payload: JwtPayload = {
        userId: identity.admin_id,
        email: identity.email,
        kind: 'admin',
        role: identity.role,
        storeId: identity.store_id,
    };

    const access = signAdminAccessToken(payload);
    const newRaw = generateRawRefresh();

    const persisted = await withTransaction(async (conn) => {
        const update = (await conn.query(
            `UPDATE admin_refresh_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE token_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
            [record.token_id],
        )) as { affectedRows: number };
        if (Number(update.affectedRows) === 0) {
            throw new AuthenticationError(
                '토큰 회전에 실패했습니다.',
                'REFRESH_TOKEN_RACE',
            );
        }

        const tokenId = uuidv4();
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await conn.query(
            `INSERT INTO admin_refresh_tokens
                (token_id, admin_id, token_hash, family_id, parent_id, user_agent, ip, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tokenId,
                record.admin_id,
                hashToken(newRaw),
                record.family_id,
                record.token_id,
                ctx.userAgent ?? null,
                ctx.ip ?? null,
                expiresAt,
            ],
        );
        return { tokenId, expiresAt };
    });

    return {
        accessToken: access.token,
        accessExpiresInSec: access.expiresInSec,
        refreshToken: newRaw,
        refreshExpiresAt: persisted.expiresAt,
    };
}

export async function revokeAdminRefresh(rawRefresh: string): Promise<void> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await query<Array<{ family_id: string }>>(
        'SELECT family_id FROM admin_refresh_tokens WHERE token_hash = ?',
        [tokenHash],
    );
    if (rows.length === 0) return;
    await revokeAdminFamily(rows[0].family_id, 'admin_logout');
}
