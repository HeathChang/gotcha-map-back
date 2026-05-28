import { query } from '../config/database';
import { AdminAuditLogRow } from '../types';

const AUDIT_COLUMNS = [
    'a.audit_id',
    'a.admin_id',
    'au.email AS admin_email',
    'au.name AS admin_name',
    'a.action',
    'a.target_type',
    'a.target_id',
    'a.diff',
    'a.ip',
    'a.user_agent',
    'a.created_at',
].join(', ');

interface AdminAuditLogJoinedRow extends AdminAuditLogRow {
    admin_email: string | null;
    admin_name: string | null;
}

export interface AdminAuditLogResponse {
    auditId: string;
    adminId: string;
    adminEmail: string | null;
    adminName: string | null;
    action: string;
    targetType: string;
    targetId: string;
    diff: unknown;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
}

function parseDiff(raw: unknown): unknown {
    // mariadb 커넥터는 JSON 컬럼을 문자열로 돌려줄 수 있어 안전하게 파싱한다.
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }
    return raw ?? null;
}

function toAdminAuditLog(row: AdminAuditLogJoinedRow): AdminAuditLogResponse {
    return {
        auditId: row.audit_id,
        adminId: row.admin_id,
        adminEmail: row.admin_email,
        adminName: row.admin_name,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        diff: parseDiff(row.diff),
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: row.created_at,
    };
}

export async function listAuditLogsForAdmin(params: {
    targetType?: string;
    action?: string;
    page: number;
    limit: number;
}) {
    const offset = (params.page - 1) * params.limit;

    const whereParts: string[] = [];
    const whereArgs: Array<string> = [];
    if (params.targetType) {
        whereParts.push('a.target_type = ?');
        whereArgs.push(params.targetType);
    }
    if (params.action) {
        whereParts.push('a.action = ?');
        whereArgs.push(params.action);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM admin_audit_logs a ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<AdminAuditLogJoinedRow[]>(
        `SELECT ${AUDIT_COLUMNS}
         FROM admin_audit_logs a
         LEFT JOIN admin_users au ON au.admin_id = a.admin_id
         ${whereSql}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );
    return {
        items: rows.map(toAdminAuditLog),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}
