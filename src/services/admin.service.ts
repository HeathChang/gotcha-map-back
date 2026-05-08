import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { comparePassword } from '../utils/password';
import { AuthenticationError } from '../utils/errors';
import {
    AdminAuditLogRow,
    AdminRole,
    AdminUserRow,
    JwtPayload,
} from '../types';
import {
    AdminIssuedTokens,
    issueAdminTokens,
    revokeAdminRefresh,
} from './adminTokens.service';

const PUBLIC_ADMIN_COLUMNS =
    'admin_id, email, name, role, admin_status, created_at, updated_at';

type PublicAdminRow = Omit<AdminUserRow, 'password'>;

export interface AdminPublicProfile {
    adminId: string;
    email: string;
    name: string;
    role: AdminRole;
    createdAt: Date;
}

function toAdminProfile(row: PublicAdminRow): AdminPublicProfile {
    return {
        adminId: row.admin_id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.created_at,
    };
}

export interface AdminLoginResult {
    user: AdminPublicProfile;
    accessToken: string;
    accessExpiresInSec: number;
    refreshToken: string;
    refreshExpiresAt: Date;
}

export async function loginAdmin(
    email: string,
    password: string,
    ctx: { userAgent?: string; ip?: string } = {},
): Promise<AdminLoginResult> {
    const rows = await query<Array<PublicAdminRow & { password: string }>>(
        `SELECT ${PUBLIC_ADMIN_COLUMNS}, password
         FROM admin_users
         WHERE email = ? AND admin_status = 1`,
        [email],
    );
    if (rows.length === 0) {
        throw new AuthenticationError(
            '이메일 또는 비밀번호가 올바르지 않습니다.',
            'INVALID_ADMIN_CREDENTIALS',
        );
    }

    const row = rows[0];
    const isMatch = await comparePassword(password, row.password);
    if (!isMatch) {
        throw new AuthenticationError(
            '이메일 또는 비밀번호가 올바르지 않습니다.',
            'INVALID_ADMIN_CREDENTIALS',
        );
    }

    const payload: JwtPayload = {
        userId: row.admin_id,
        email: row.email,
        kind: 'admin',
        role: row.role,
    };
    const tokens: AdminIssuedTokens = await issueAdminTokens(payload, ctx);

    const { password: _pw, ...publicRow } = row;
    return {
        user: toAdminProfile(publicRow),
        accessToken: tokens.accessToken,
        accessExpiresInSec: tokens.accessExpiresInSec,
        refreshToken: tokens.refreshToken,
        refreshExpiresAt: tokens.refreshExpiresAt,
    };
}

export async function logoutAdmin(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await revokeAdminRefresh(refreshToken);
}

export async function getAdminProfile(
    adminId: string,
): Promise<AdminPublicProfile> {
    const rows = await query<PublicAdminRow[]>(
        `SELECT ${PUBLIC_ADMIN_COLUMNS}
         FROM admin_users
         WHERE admin_id = ? AND admin_status = 1`,
        [adminId],
    );
    if (rows.length === 0) {
        throw new AuthenticationError(
            '어드민 계정을 찾을 수 없습니다.',
            'ADMIN_NOT_FOUND',
        );
    }
    return toAdminProfile(rows[0]);
}

// ================================================================
// 감사 로그 (vision §3 성공기준: 모든 mutation 100% 기록)
// ================================================================

export interface WriteAuditLogParams {
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    diff?: { before?: unknown; after?: unknown } | null;
    ip?: string | null;
    userAgent?: string | null;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
    await query(
        `INSERT INTO admin_audit_logs
            (audit_id, admin_id, action, target_type, target_id, diff, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            uuidv4(),
            params.adminId,
            params.action,
            params.targetType,
            params.targetId,
            params.diff ? JSON.stringify(params.diff) : null,
            params.ip ?? null,
            params.userAgent ?? null,
        ],
    );
}

export type AdminAuditLogResponse = {
    auditId: string;
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    diff: unknown;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
};

export function toAuditLog(row: AdminAuditLogRow): AdminAuditLogResponse {
    return {
        auditId: row.audit_id,
        adminId: row.admin_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        diff: row.diff,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: row.created_at,
    };
}
