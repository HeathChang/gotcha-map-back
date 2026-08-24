import { createHash, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { env } from '../config/env';
import { UserRow, JwtPayload } from '../types';
import { hashPassword, comparePassword } from '../utils/password';
import { logger } from '../utils/logger';
import { maskEmail } from '../utils/mask';
import { sendPasswordResetEmail } from '../utils/mailer';
import { issueTokensForLogin, IssuedTokens } from './tokens.service';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from '../utils/errors';

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15분

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

const PUBLIC_USER_COLUMNS =
    'user_id, email, nickname, gender, profile_image_url, user_status, user_flag, created_at, updated_at';

type PublicUserRow = Omit<UserRow, 'password'>;

function toUserResponse(row: PublicUserRow) {
    return {
        userId: row.user_id,
        email: row.email,
        nickName: row.nickname,
        gender: row.gender,
        profileImageUrl: row.profile_image_url,
        userStatus: row.user_status,
        userFlag: row.user_flag,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function findActivePublicById(userId: string): Promise<PublicUserRow | null> {
    const rows = await query<PublicUserRow[]>(
        `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE user_id = ? AND user_status = 1`,
        [userId],
    );
    return rows[0] ?? null;
}

export async function signup(email: string, password: string, nickname: string, gender?: string) {
    const hashed = await hashPassword(password);
    const userId = uuidv4();

    try {
        return await withTransaction(async (conn) => {
            await conn.query(
                `INSERT INTO users (user_id, email, password, nickname, gender) VALUES (?, ?, ?, ?, ?)`,
                [userId, email, hashed, nickname, gender ?? null],
            );
            const rows = (await conn.query(
                `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE user_id = ?`,
                [userId],
            )) as PublicUserRow[];
            return toUserResponse(rows[0]);
        });
    } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new ConflictError('이미 사용 중인 이메일입니다.', 'EMAIL_ALREADY_EXISTS');
        }
        throw err;
    }
}

export async function login(
    email: string,
    password: string,
    ctx: { userAgent?: string; ip?: string } = {},
): Promise<{
    token: string;
    accessToken: string;
    accessExpiresInSec: number;
    refreshToken: string;
    refreshExpiresAt: Date;
    user: ReturnType<typeof toUserResponse>;
}> {
    const rows = await query<Array<PublicUserRow & { password: string }>>(
        `SELECT ${PUBLIC_USER_COLUMNS}, password FROM users WHERE email = ? AND user_status = 1`,
        [email],
    );
    if (rows.length === 0) {
        throw new AuthenticationError(
            '이메일 또는 비밀번호가 올바르지 않습니다.',
            'INVALID_CREDENTIALS',
        );
    }

    const user = rows[0];
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        throw new AuthenticationError(
            '이메일 또는 비밀번호가 올바르지 않습니다.',
            'INVALID_CREDENTIALS',
        );
    }

    const tokens: IssuedTokens = await issueTokensForLogin(
        { userId: user.user_id, email: user.email },
        ctx,
    );
    const { password: _pw, ...publicRow } = user;
    return {
        // 하위 호환: 기존 클라이언트는 `token` 필드를 사용한다.
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        accessExpiresInSec: tokens.accessExpiresInSec,
        refreshToken: tokens.refreshToken,
        refreshExpiresAt: tokens.refreshExpiresAt,
        user: toUserResponse(publicRow),
    };
}

export async function getUser(userId: string) {
    const row = await findActivePublicById(userId);
    if (!row) throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    return toUserResponse(row);
}

/**
 * 회원탈퇴 — soft delete. 실제 행은 보존하고 user_status 를 -1(탈퇴)로 바꾼다.
 * login/getUser 가 user_status=1 만 통과시키므로 탈퇴 후 로그인·조회가 자동 차단된다.
 * 보유 refresh 토큰을 전부 무효화해 재로그인 경로를 끊는다. (users·tokens 를 트랜잭션으로 원자 처리)
 * ※ 이메일은 UNIQUE 라 동일 이메일 재가입은 막힌다(정책상 보류 — 추후 결정).
 */
export async function withdrawUser(userId: string) {
    await withTransaction(async (conn) => {
        const result = (await conn.query(
            `UPDATE users SET user_status = -1 WHERE user_id = ? AND user_status = 1`,
            [userId],
        )) as { affectedRows: number };
        if (Number(result.affectedRows) === 0) {
            throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
        }
        await conn.query(
            `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`,
            [userId],
        );
    });
    logger.warn('user.withdrawn', { userId });
}

export async function updateUser(
    userId: string,
    data: { email?: string; nickname?: string; gender?: string; profileImageUrl?: string },
) {
    let result: { affectedRows: number };
    try {
        result = await query<{ affectedRows: number }>(
            `UPDATE users SET email = COALESCE(?, email), nickname = COALESCE(?, nickname),
             gender = COALESCE(?, gender), profile_image_url = COALESCE(?, profile_image_url)
             WHERE user_id = ? AND user_status = 1`,
            [data.email, data.nickname, data.gender, data.profileImageUrl, userId],
        );
    } catch (err) {
        // email 은 UNIQUE — 다른 회원 이메일로 변경 시도 시 ER_DUP_ENTRY. signup 과 동일하게 409 로 변환(500 방지).
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new ConflictError('이미 사용 중인 이메일입니다.', 'EMAIL_ALREADY_EXISTS');
        }
        throw err;
    }
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    }
    return getUser(userId);
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
    const rows = await query<Array<{ password: string }>>(
        'SELECT password FROM users WHERE user_id = ? AND user_status = 1',
        [userId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    }

    const isMatch = await comparePassword(oldPassword, rows[0].password);
    if (!isMatch) {
        throw new ValidationError('기존 비밀번호가 올바르지 않습니다.', 'INVALID_OLD_PASSWORD');
    }

    const hashed = await hashPassword(newPassword);
    await query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, userId]);
}

/**
 * 비밀번호 재설정 토큰 발급.
 * 보안: 계정 존재 여부를 응답으로 노출하지 않는다(auth.md). 따라서 호출자 입장에서는
 * 항상 동일한 결과로 보이도록 처리하고, 실제 토큰은 이메일 채널을 통해서만 전달한다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
    const rows = await query<Array<{ user_id: string }>>(
        'SELECT user_id FROM users WHERE email = ? AND user_status = 1',
        [email],
    );
    if (rows.length === 0) {
        // 존재하지 않는 계정 — 응답은 동일하게 처리하되, 운영자는 로그로 식별 가능.
        logger.info('password_reset.request.no_account', { emailMasked: maskEmail(email) });
        return;
    }

    const userId = rows[0].user_id;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await withTransaction(async (conn) => {
        // 동일 사용자의 미사용 토큰을 무효화 — 1회용 + rotation
        await conn.query(
            'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
            [userId],
        );
        await conn.query(
            `INSERT INTO password_reset_tokens (token_id, user_id, token_hash, expires_at)
             VALUES (?, ?, ?, ?)`,
            [uuidv4(), userId, tokenHash, expiresAt],
        );
    });

    // 이메일로 재설정 코드(=토큰 원문) 발송. SMTP 미설정 시 no-op(로컬/테스트), 실패해도 throw 안 함
    // → 계정 존재 여부를 응답으로 노출하지 않는다는 원칙 유지.
    const sent = await sendPasswordResetEmail(email, rawToken, RESET_TOKEN_TTL_MS / 60000);

    logger.info('password_reset.token.issued', {
        userId,
        emailMasked: maskEmail(email),
        expiresAt: expiresAt.toISOString(),
        mailSent: sent,
        // 평문 토큰은 운영 로그에 남기지 않는다. SMTP 미설정 개발환경에서만 로컬 테스트용으로 노출.
        ...(env.NODE_ENV !== 'production' && !sent ? { devToken: rawToken } : {}),
    });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);

    const rows = await query<Array<{ token_id: string; user_id: string; expires_at: Date; used_at: Date | null }>>(
        `SELECT token_id, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = ?`,
        [tokenHash],
    );

    const record = rows[0];
    const now = Date.now();
    const isInvalid =
        !record ||
        record.used_at !== null ||
        new Date(record.expires_at).getTime() < now;

    if (isInvalid) {
        throw new ValidationError(
            '유효하지 않거나 만료된 토큰입니다.',
            'INVALID_RESET_TOKEN',
        );
    }

    const hashed = await hashPassword(newPassword);

    await withTransaction(async (conn) => {
        const result = (await conn.query(
            `UPDATE password_reset_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE token_id = ? AND used_at IS NULL`,
            [record.token_id],
        )) as { affectedRows: number };

        // 1회용 보장: 토큰 사용 처리에 실패하면(동시성 등) 비밀번호 변경도 중단.
        if (Number(result.affectedRows) === 0) {
            throw new ValidationError(
                '유효하지 않거나 만료된 토큰입니다.',
                'INVALID_RESET_TOKEN',
            );
        }

        await conn.query(
            'UPDATE users SET password = ? WHERE user_id = ? AND user_status = 1',
            [hashed, record.user_id],
        );
    });

    logger.info('password_reset.confirmed', { userId: record.user_id });
}
