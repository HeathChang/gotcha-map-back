import { query, withTransaction } from '../config/database';
import { InquiryRow, InquiryStatus } from '../types';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';

const ADMIN_INQUIRY_COLUMNS = [
    'i.inquiry_id',
    'i.user_id',
    'u.email AS user_email',
    'i.title',
    'i.content',
    'i.category',
    'i.email',
    'i.status',
    'i.answer',
    'i.answered_at',
    'i.answered_by_admin_id',
    'i.created_at',
    'i.updated_at',
].join(', ');

interface AdminInquiryRow extends InquiryRow {
    user_email: string;
    answered_by_admin_id: string | null;
}

export interface AdminInquiryResponse {
    inquiryId: string;
    userId: string;
    userEmail: string;
    title: string;
    content: string;
    status: InquiryStatus;
    answer: string | null;
    answeredAt: Date | null;
    answeredByAdminId: string | null;
    createdAt: Date;
}

function toAdminInquiry(row: AdminInquiryRow): AdminInquiryResponse {
    return {
        inquiryId: row.inquiry_id,
        userId: row.user_id,
        userEmail: row.user_email,
        title: row.title,
        content: row.content,
        status: row.status,
        answer: row.answer,
        answeredAt: row.answered_at,
        answeredByAdminId: row.answered_by_admin_id,
        createdAt: row.created_at,
    };
}

export interface PaginatedAdminInquiries {
    items: AdminInquiryResponse[];
    total: number;
    page: number;
    limit: number;
}

export async function listAdminInquiries(params: {
    status?: InquiryStatus;
    page: number;
    limit: number;
}): Promise<PaginatedAdminInquiries> {
    const { status, page, limit } = params;
    const offset = (page - 1) * limit;

    const whereParts: string[] = [];
    const whereArgs: unknown[] = [];
    if (status) {
        whereParts.push('i.status = ?');
        whereArgs.push(status);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM inquiries i ${whereSql}`,
        whereArgs,
    );
    const total = Number(totalRows[0]?.total ?? 0);

    const rows = await query<AdminInquiryRow[]>(
        `SELECT ${ADMIN_INQUIRY_COLUMNS}
         FROM inquiries i
         JOIN users u ON u.user_id = i.user_id
         ${whereSql}
         ORDER BY i.created_at DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, limit, offset],
    );

    return {
        items: rows.map(toAdminInquiry),
        total,
        page,
        limit,
    };
}

async function fetchAdminInquiry(inquiryId: string): Promise<AdminInquiryResponse> {
    const rows = await query<AdminInquiryRow[]>(
        `SELECT ${ADMIN_INQUIRY_COLUMNS}
         FROM inquiries i
         JOIN users u ON u.user_id = i.user_id
         WHERE i.inquiry_id = ?`,
        [inquiryId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('문의를 찾을 수 없습니다.', 'INQUIRY_NOT_FOUND');
    }
    return toAdminInquiry(rows[0]);
}

export async function answerAdminInquiry(params: {
    inquiryId: string;
    adminId: string;
    status: InquiryStatus;
    answer: string;
    ip?: string | null;
    userAgent?: string | null;
}): Promise<AdminInquiryResponse> {
    const before = await fetchAdminInquiry(params.inquiryId);

    const updated = await withTransaction(async (conn) => {
        const result = (await conn.query(
            `UPDATE inquiries
             SET status = ?,
                 answer = ?,
                 answered_at = CURRENT_TIMESTAMP,
                 answered_by_admin_id = ?
             WHERE inquiry_id = ?`,
            [params.status, params.answer, params.adminId, params.inquiryId],
        )) as { affectedRows: number };

        if (Number(result.affectedRows) === 0) {
            throw new NotFoundError('문의를 찾을 수 없습니다.', 'INQUIRY_NOT_FOUND');
        }

        const rows = (await conn.query(
            `SELECT ${ADMIN_INQUIRY_COLUMNS}
             FROM inquiries i
             JOIN users u ON u.user_id = i.user_id
             WHERE i.inquiry_id = ?`,
            [params.inquiryId],
        )) as AdminInquiryRow[];
        return toAdminInquiry(rows[0]);
    });

    await writeAuditLog({
        adminId: params.adminId,
        action: 'inquiry.answer',
        targetType: 'inquiry',
        targetId: params.inquiryId,
        diff: {
            before: { status: before.status, answer: before.answer },
            after: { status: updated.status, answer: updated.answer },
        },
        ip: params.ip,
        userAgent: params.userAgent,
    });

    return updated;
}
