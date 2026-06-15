import { query } from '../config/database';
import { AdminRole, UserRow } from '../types';
import { NotFoundError } from '../utils/errors';
import { maskEmail } from '../utils/mask';
import { writeAuditLog } from './admin.service';
import type { AuditActor } from './adminTag.service';

const ADMIN_USER_COLUMNS =
    'user_id, email, nickname, gender, profile_image_url, user_status, user_flag, created_at, updated_at';

type PublicUserRow = Omit<UserRow, 'password'>;

export interface AdminUserResponse {
    userId: string;
    email: string; // 노출 시점에 actorRole 에 따라 마스킹된다.
    nickname: string;
    gender: 'M' | 'F' | null;
    profileImageUrl: string | null;
    /** 1=활성, 0=비활성, -1=탈퇴 (스키마 0001). */
    userStatus: number;
    userFlag: number;
    createdAt: Date;
    updatedAt: Date;
}

function toAdminUser(row: PublicUserRow): AdminUserResponse {
    return {
        userId: row.user_id,
        email: row.email,
        nickname: row.nickname,
        gender: row.gender,
        profileImageUrl: row.profile_image_url,
        userStatus: row.user_status,
        userFlag: row.user_flag,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * admin·staff 는 PII(이메일) 풀 노출 (gotcha-map-policy §7 — Q2 확정).
 * member 는 회원 라우트에 접근하지 못하므로 도달하지 않는다.
 * 마스킹 분기는 향후 역할 추가 대비로 유지(현 운영 역할에는 적용 안 됨).
 */
function applyPiiMask(user: AdminUserResponse, role: AdminRole): AdminUserResponse {
    if (role === 'admin' || role === 'staff') return user;
    return {
        ...user,
        email: maskEmail(user.email) ?? '***',
    };
}

async function getAdminUser(userId: string): Promise<AdminUserResponse> {
    const rows = await query<PublicUserRow[]>(
        `SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE user_id = ?`,
        [userId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('회원을 찾을 수 없습니다.', 'USER_NOT_FOUND');
    }
    return toAdminUser(rows[0]);
}

export async function listUsersForAdmin(params: {
    q?: string;
    status?: number;
    page: number;
    limit: number;
    actorRole: AdminRole;
}) {
    const offset = (params.page - 1) * params.limit;

    const whereParts: string[] = [];
    const whereArgs: Array<string | number> = [];
    if (params.q) {
        whereParts.push('(email LIKE ? OR nickname LIKE ?)');
        const kw = `%${params.q}%`;
        whereArgs.push(kw, kw);
    }
    if (params.status !== undefined) {
        whereParts.push('user_status = ?');
        whereArgs.push(params.status);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM users ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<PublicUserRow[]>(
        `SELECT ${ADMIN_USER_COLUMNS} FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );

    const items = rows.map(toAdminUser).map((u) => applyPiiMask(u, params.actorRole));

    return {
        items,
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function updateUserStatus(
    userId: string,
    status: number,
    actor: AuditActor & { role: AdminRole },
): Promise<AdminUserResponse> {
    const before = await getAdminUser(userId);

    // 동일 상태로의 변경이면 no-op + 감사 미기록 (tag/announcement no-op 패턴).
    if (before.userStatus === status) {
        return applyPiiMask(before, actor.role);
    }

    const result = (await query(
        `UPDATE users SET user_status = ? WHERE user_id = ?`,
        [status, userId],
    )) as { affectedRows: number };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('회원을 찾을 수 없습니다.', 'USER_NOT_FOUND');
    }
    const updated = await getAdminUser(userId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'user.status',
        targetType: 'user',
        targetId: userId,
        diff: {
            before: { userStatus: before.userStatus },
            after: { userStatus: updated.userStatus },
        },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });

    return applyPiiMask(updated, actor.role);
}
