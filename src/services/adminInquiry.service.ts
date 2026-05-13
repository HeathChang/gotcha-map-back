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

export interface AdminInquiryStats {
    /** 상태별 건수. 활성 SLA 추적은 `pending` + `processing` 합산. */
    countByStatus: {
        pending: number;
        processing: number;
        completed: number;
        rejected: number;
    };
    /** 응답 완료된 문의의 평균 응답 시간 (시간 단위). */
    avgResponseHours: number | null;
    /** 응답 완료된 문의의 중앙값 응답 시간 (시간 단위). */
    medianResponseHours: number | null;
    /** SLA(24h) 위반 미답변 건수 — 운영팀이 가장 먼저 보아야 하는 수치. */
    overdueCount: number;
    /** 통계 산출에 사용된 응답 완료 표본 수. */
    answeredSampleSize: number;
}

export async function listAdminInquiries(params: {
    status?: InquiryStatus;
    q?: string;
    page: number;
    limit: number;
}): Promise<PaginatedAdminInquiries> {
    const { status, q, page, limit } = params;
    const offset = (page - 1) * limit;

    const whereParts: string[] = [];
    const whereArgs: unknown[] = [];
    if (status) {
        whereParts.push('i.status = ?');
        whereArgs.push(status);
    }
    if (q) {
        // 제목 OR 요청자 이메일 부분 일치. LIKE 와일드카드는 사용자 입력이 아니라 서버에서 부착한다.
        whereParts.push('(i.title LIKE ? OR u.email LIKE ?)');
        const pattern = `%${q}%`;
        whereArgs.push(pattern, pattern);
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

/**
 * 관리자 SLA 대시보드용 집계.
 * vision §3 (admin) "신규 문의 응답 평균 시간 24시간 이내 측정 가능" 의 측정 인프라.
 * - countByStatus: 빠른 1차 진단용
 * - avg/median responseHours: 추세 모니터링용 (평균은 outlier에 약하므로 median 동반)
 * - overdueCount: 24h 초과 미답변 건수 (가장 먼저 손대야 할 수치)
 */
export async function getAdminInquiryStats(): Promise<AdminInquiryStats> {
    const statusRows = await query<Array<{ status: InquiryStatus; total: bigint | number }>>(
        `SELECT status, COUNT(*) AS total FROM inquiries GROUP BY status`,
    );
    const countByStatus: AdminInquiryStats['countByStatus'] = {
        pending: 0,
        processing: 0,
        completed: 0,
        rejected: 0,
    };
    for (const row of statusRows) {
        countByStatus[row.status] = Number(row.total);
    }

    // 응답 완료(answered_at IS NOT NULL) 문의에 한해 응답 시간 통계 산출.
    const responseRows = await query<Array<{ hours: number }>>(
        `SELECT TIMESTAMPDIFF(SECOND, created_at, answered_at) / 3600.0 AS hours
         FROM inquiries
         WHERE answered_at IS NOT NULL`,
    );
    const hoursList = responseRows.map((r) => Number(r.hours)).sort((a, b) => a - b);
    const sampleSize = hoursList.length;
    const avgResponseHours =
        sampleSize > 0 ? hoursList.reduce((acc, v) => acc + v, 0) / sampleSize : null;
    const medianResponseHours =
        sampleSize > 0
            ? sampleSize % 2 === 1
                ? hoursList[(sampleSize - 1) / 2]
                : (hoursList[sampleSize / 2 - 1] + hoursList[sampleSize / 2]) / 2
            : null;

    // 24h 초과 미답변 — pending/processing 중 created_at 이 24h 이전인 것.
    const overdueRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM inquiries
         WHERE status IN ('pending', 'processing')
           AND created_at < (NOW() - INTERVAL 24 HOUR)`,
    );
    const overdueCount = Number(overdueRows[0]?.total ?? 0);

    return {
        countByStatus,
        avgResponseHours,
        medianResponseHours,
        overdueCount,
        answeredSampleSize: sampleSize,
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
