/**
 * 운영자(admin_users) 관리 — admin 전용 (gotcha-map-policy §9, Q5).
 * 계정 생성/상태변경/비밀번호 재설정. member 생성 시 담당 매장(store_id) 배정.
 * 모든 mutation 은 감사 로그(targetType=admin_user) 기록.
 */
import { query } from '../config/database';
import { AdminRole } from '../types';
import { ConflictError, NotFoundError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { writeAuditLog } from './admin.service';
import { getStore } from './store.service';
import type { AuditActor } from './adminTag.service';

export interface AdminManagedUser {
    adminId: string;
    email: string;
    name: string;
    role: AdminRole;
    storeId: string | null;
    storeName: string | null;
    status: number;
    createdAt: Date;
    updatedAt: Date;
}

interface ManagedRow {
    admin_id: string;
    email: string;
    name: string;
    role: AdminRole;
    store_id: string | null;
    store_name: string | null;
    admin_status: number;
    created_at: Date;
    updated_at: Date;
}

const MANAGED_SELECT = `
    SELECT a.admin_id, a.email, a.name, a.role, a.store_id,
           s.name AS store_name, a.admin_status, a.created_at, a.updated_at
    FROM admin_users a
    LEFT JOIN stores s ON s.store_id = a.store_id`;

function toManaged(row: ManagedRow): AdminManagedUser {
    return {
        adminId: row.admin_id,
        email: row.email,
        name: row.name,
        role: row.role,
        storeId: row.store_id,
        storeName: row.store_name,
        status: row.admin_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function getManagedOrThrow(adminId: string): Promise<AdminManagedUser> {
    const rows = await query<ManagedRow[]>(`${MANAGED_SELECT} WHERE a.admin_id = ?`, [adminId]);
    if (rows.length === 0) {
        throw new NotFoundError('운영자 계정을 찾을 수 없습니다.', 'ADMIN_USER_NOT_FOUND');
    }
    return toManaged(rows[0]);
}

export async function listAdmins(params: {
    q?: string;
    role?: AdminRole;
    page: number;
    limit: number;
}) {
    const offset = (params.page - 1) * params.limit;
    const whereParts: string[] = [];
    const whereArgs: Array<string> = [];
    if (params.q) {
        whereParts.push('(a.email LIKE ? OR a.name LIKE ?)');
        whereArgs.push(`%${params.q}%`, `%${params.q}%`);
    }
    if (params.role) {
        whereParts.push('a.role = ?');
        whereArgs.push(params.role);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM admin_users a ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<ManagedRow[]>(
        `${MANAGED_SELECT} ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );
    return {
        items: rows.map(toManaged),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export interface CreateAdminParams {
    email: string;
    password: string;
    name: string;
    role: AdminRole;
    storeId?: string | null;
}

export async function createAdmin(
    params: CreateAdminParams,
    actor: AuditActor,
): Promise<AdminManagedUser> {
    const dup = await query<Array<{ admin_id: string }>>(
        'SELECT admin_id FROM admin_users WHERE email = ?',
        [params.email],
    );
    if (dup.length > 0) {
        throw new ConflictError('이미 사용 중인 이메일입니다.', 'ADMIN_EMAIL_EXISTS');
    }

    // member 만 매장 배정. admin/staff 는 매장을 갖지 않는다.
    const storeId = params.role === 'member' ? (params.storeId ?? null) : null;
    if (params.role === 'member') {
        if (!storeId) {
            throw new ConflictError('member 는 담당 매장이 필요합니다.', 'MEMBER_STORE_REQUIRED');
        }
        await getStore(storeId); // 존재 검증 (없으면 STORE_NOT_FOUND)
    }

    const hashed = await hashPassword(params.password);
    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const adminId = idRows[0]?.id;
    if (!adminId) throw new Error('UUID 생성 실패');

    await query(
        `INSERT INTO admin_users (admin_id, email, password, name, role, store_id, admin_status)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [adminId, params.email, hashed, params.name, params.role, storeId],
    );
    const created = await getManagedOrThrow(adminId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'admin_user.create',
        targetType: 'admin_user',
        targetId: adminId,
        diff: { after: created }, // 응답 객체엔 password 가 없다.
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateAdminStatus(
    adminId: string,
    status: number,
    actor: AuditActor,
): Promise<AdminManagedUser> {
    const before = await getManagedOrThrow(adminId);
    if (before.status === status) return before;

    await query('UPDATE admin_users SET admin_status = ? WHERE admin_id = ?', [status, adminId]);

    // H1: 비활성(상태≠1)으로 전환하면 해당 어드민의 refresh 토큰을 전부 철회한다(퇴사/침해 즉시 차단).
    if (status !== 1) {
        await query(
            `UPDATE admin_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = ? AND revoked_at IS NULL`,
            [adminId],
        );
    }

    const updated = await getManagedOrThrow(adminId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'admin_user.status',
        targetType: 'admin_user',
        targetId: adminId,
        diff: { before: { status: before.status }, after: { status: updated.status } },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function resetAdminPassword(
    adminId: string,
    newPassword: string,
    actor: AuditActor,
): Promise<void> {
    await getManagedOrThrow(adminId); // 존재 검증
    const hashed = await hashPassword(newPassword);
    await query('UPDATE admin_users SET password = ? WHERE admin_id = ?', [hashed, adminId]);

    // 비밀번호 평문/해시는 diff 에 절대 남기지 않는다.
    await writeAuditLog({
        adminId: actor.adminId,
        action: 'admin_user.password_reset',
        targetType: 'admin_user',
        targetId: adminId,
        diff: null,
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
