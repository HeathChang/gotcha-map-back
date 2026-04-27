import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/database';
import { env } from '../config/env';
import { UserRow, JwtPayload } from '../types';
import { hashPassword, comparePassword } from '../utils/password';
import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from '../utils/errors';

const PUBLIC_USER_COLUMNS =
    'user_id, email, nickname, gender, profile_image_url, user_status, user_flag, created_at, updated_at';

type PublicUserRow = Omit<UserRow, 'password'>;

function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as string & jwt.SignOptions['expiresIn'],
    });
}

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

async function findPublicById(userId: string): Promise<PublicUserRow | null> {
    const rows = await query<PublicUserRow[]>(
        `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE user_id = ?`,
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

export async function login(email: string, password: string) {
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

    const token = signToken({ userId: user.user_id, email: user.email });
    const { password: _pw, ...publicRow } = user;
    return { token, user: toUserResponse(publicRow) };
}

export async function getUser(userId: string) {
    const row = await findPublicById(userId);
    if (!row) throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    return toUserResponse(row);
}

export async function updateUser(
    userId: string,
    data: { email?: string; nickname?: string; gender?: string; profileImageUrl?: string },
) {
    await query(
        `UPDATE users SET email = COALESCE(?, email), nickname = COALESCE(?, nickname),
         gender = COALESCE(?, gender), profile_image_url = COALESCE(?, profile_image_url)
         WHERE user_id = ?`,
        [data.email, data.nickname, data.gender, data.profileImageUrl, userId],
    );
    return getUser(userId);
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
    const rows = await query<Array<{ password: string }>>(
        'SELECT password FROM users WHERE user_id = ?',
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

export async function resetPassword(userId: string, email: string, newPassword: string) {
    const rows = await query<Array<{ user_id: string }>>(
        'SELECT user_id FROM users WHERE user_id = ? AND email = ?',
        [userId, email],
    );
    if (rows.length === 0) {
        throw new NotFoundError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
    }

    const hashed = await hashPassword(newPassword);
    await query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, userId]);
}
