import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { env } from '../config/env';
import { JwtPayload } from '../types';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface IssuedTokens {
    accessToken: string;
    accessExpiresInSec: number;
    refreshToken: string;
    refreshExpiresAt: Date;
}

interface RefreshContext {
    userAgent?: string;
    ip?: string;
}

interface RefreshRow {
    token_id: string;
    user_id: string;
    family_id: string;
    parent_id: string | null;
    expires_at: Date;
    used_at: Date | null;
    revoked_at: Date | null;
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload: JwtPayload): { token: string; expiresInSec: number } {
    const ttl = env.ACCESS_TOKEN_TTL as string & jwt.SignOptions['expiresIn'];
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: ttl });
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresInSec = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
    return { token, expiresInSec };
}

function generateRawRefresh(): string {
    return randomBytes(48).toString('base64url');
}

async function persistRefresh(params: {
    userId: string;
    familyId: string;
    parentId: string | null;
    rawToken: string;
    ctx: RefreshContext;
}): Promise<{ tokenId: string; expiresAt: Date }> {
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await query(
        `INSERT INTO refresh_tokens
            (token_id, user_id, token_hash, family_id, parent_id, user_agent, ip, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            tokenId,
            params.userId,
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

export async function issueTokensForLogin(
    payload: JwtPayload,
    ctx: RefreshContext = {},
): Promise<IssuedTokens> {
    const access = signAccessToken(payload);
    const rawRefresh = generateRawRefresh();
    const familyId = uuidv4();
    const persisted = await persistRefresh({
        userId: payload.userId,
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

async function revokeFamily(familyId: string, reason: string): Promise<void> {
    await query(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE family_id = ? AND revoked_at IS NULL`,
        [familyId],
    );
    logger.warn('refresh_token.family_revoked', { familyId, reason });
}

/**
 * Refresh 토큰 회전.
 *  - 토큰 해시 매칭 + 만료/사용/철회 검사.
 *  - 재사용(동일 토큰 두 번 사용)이 감지되면 family 전체를 즉시 무효화한다.
 *  - 정상 회전 시 직전 토큰을 used 처리하고 새 토큰을 발급한다.
 *  - 신원(userId/email)은 refresh_token 레코드의 user_id 로 DB 를 재조회해 재구성한다.
 *    client access 토큰의 클레임(role/kind)은 신뢰하지 않는다 — 위조 클레임으로 admin
 *    토큰을 발급받는 권한상승(C1)을 차단한다. 소비자 토큰은 role/kind 를 갖지 않는다.
 */
export async function rotateRefresh(
    rawRefresh: string,
    ctx: RefreshContext = {},
): Promise<IssuedTokens> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await query<RefreshRow[]>(
        `SELECT token_id, user_id, family_id, parent_id, expires_at, used_at, revoked_at
         FROM refresh_tokens WHERE token_hash = ?`,
        [tokenHash],
    );
    const record = rows[0];

    if (!record) {
        throw new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_REFRESH_TOKEN');
    }

    if (record.revoked_at !== null) {
        throw new AuthenticationError('철회된 토큰입니다.', 'REVOKED_REFRESH_TOKEN');
    }

    if (record.used_at !== null) {
        // 재사용 감지 — 같은 family 전체를 무효화하고 거부 (auth.md "재사용 감지").
        await revokeFamily(record.family_id, 'refresh_token_reuse_detected');
        throw new AuthenticationError(
            '재사용이 감지되어 세션이 무효화되었습니다. 다시 로그인하세요.',
            'REFRESH_TOKEN_REUSE',
        );
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
        throw new AuthenticationError('만료된 토큰입니다.', 'EXPIRED_REFRESH_TOKEN');
    }

    // 신원은 refresh_token 레코드의 user_id 로 DB 를 재조회해 재구성한다.
    // client 가 Authorization 으로 보낸 access 는 서명 미검증이라 신뢰하지 않는다 —
    // 위조 role/kind 로 admin 토큰을 발급받는 권한상승(C1)을 차단. 소비자는 role/kind 없음.
    const identityRows = await query<Array<{ user_id: string; email: string }>>(
        'SELECT user_id, email FROM users WHERE user_id = ? AND user_status = 1',
        [record.user_id],
    );
    const identity = identityRows[0];
    if (!identity) {
        // 비활성/탈퇴 계정은 회전을 거부한다 (H1 refresh 벡터 동시 차단).
        throw new AuthenticationError('유효하지 않은 토큰입니다.', 'INVALID_REFRESH_TOKEN');
    }
    const payload: JwtPayload = { userId: identity.user_id, email: identity.email };

    const access = signAccessToken(payload);
    const newRaw = generateRawRefresh();

    const persisted = await withTransaction(async (conn) => {
        const update = (await conn.query(
            `UPDATE refresh_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE token_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
            [record.token_id],
        )) as { affectedRows: number };
        if (Number(update.affectedRows) === 0) {
            // 동시 회전 시도. 안전하게 실패 처리.
            throw new AuthenticationError(
                '토큰 회전에 실패했습니다.',
                'REFRESH_TOKEN_RACE',
            );
        }

        const tokenId = uuidv4();
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await conn.query(
            `INSERT INTO refresh_tokens
                (token_id, user_id, token_hash, family_id, parent_id, user_agent, ip, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tokenId,
                record.user_id,
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

/** 로그아웃: 해당 토큰의 family 전체를 무효화한다. */
export async function revokeRefresh(rawRefresh: string): Promise<void> {
    const tokenHash = hashToken(rawRefresh);
    const rows = await query<Array<{ family_id: string }>>(
        'SELECT family_id FROM refresh_tokens WHERE token_hash = ?',
        [tokenHash],
    );
    if (rows.length === 0) return;
    await revokeFamily(rows[0].family_id, 'logout');
}
