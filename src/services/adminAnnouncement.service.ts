import { query } from '../config/database';
import { AnnouncementRow } from '../types';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';
import type { AuditActor } from './adminTag.service';

const ANNOUNCEMENT_COLUMNS =
    'announce_id, title, content, is_active, created_at, updated_at';

export interface AdminAnnouncementResponse {
    announceId: string;
    title: string;
    content: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toAdminAnnouncement(row: AnnouncementRow): AdminAnnouncementResponse {
    return {
        announceId: row.announce_id,
        title: row.title,
        content: row.content,
        // mariadb 는 BOOLEAN 을 0/1 로 돌려주므로 명시적으로 boolean 화한다.
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface CreateAnnouncementParams {
    title: string;
    content: string;
    isActive?: boolean;
}

export type UpdateAnnouncementParams = Partial<CreateAnnouncementParams>;

async function getAnnouncement(announceId: string): Promise<AdminAnnouncementResponse> {
    const rows = await query<AnnouncementRow[]>(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements WHERE announce_id = ?`,
        [announceId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('공지를 찾을 수 없습니다.', 'ANNOUNCEMENT_NOT_FOUND');
    }
    return toAdminAnnouncement(rows[0]);
}

export async function listAnnouncementsForAdmin(params: {
    q?: string;
    isActive?: boolean;
    page: number;
    limit: number;
}) {
    const offset = (params.page - 1) * params.limit;

    const whereParts: string[] = [];
    const whereArgs: Array<string | number> = [];
    if (params.q) {
        whereParts.push('title LIKE ?');
        whereArgs.push(`%${params.q}%`);
    }
    if (params.isActive !== undefined) {
        whereParts.push('is_active = ?');
        whereArgs.push(params.isActive ? 1 : 0);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM announcements ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<AnnouncementRow[]>(
        `SELECT ${ANNOUNCEMENT_COLUMNS} FROM announcements ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );
    return {
        items: rows.map(toAdminAnnouncement),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function createAnnouncement(
    params: CreateAnnouncementParams,
    actor: AuditActor,
): Promise<AdminAnnouncementResponse> {
    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const announceId = idRows[0]?.id;
    if (!announceId) {
        throw new Error('UUID 생성 실패');
    }

    await query(
        `INSERT INTO announcements (announce_id, title, content, is_active) VALUES (?, ?, ?, ?)`,
        [announceId, params.title, params.content, (params.isActive ?? true) ? 1 : 0],
    );
    const created = await getAnnouncement(announceId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'announcement.create',
        targetType: 'announcement',
        targetId: announceId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateAnnouncement(
    announceId: string,
    params: UpdateAnnouncementParams,
    actor: AuditActor,
): Promise<AdminAnnouncementResponse> {
    const before = await getAnnouncement(announceId);

    const fields: string[] = [];
    const args: Array<string | number> = [];
    if (params.title !== undefined) {
        fields.push('title = ?');
        args.push(params.title);
    }
    if (params.content !== undefined) {
        fields.push('content = ?');
        args.push(params.content);
    }
    if (params.isActive !== undefined) {
        fields.push('is_active = ?');
        args.push(params.isActive ? 1 : 0);
    }
    if (fields.length === 0) {
        return before;
    }

    args.push(announceId);
    await query(
        `UPDATE announcements SET ${fields.join(', ')} WHERE announce_id = ?`,
        args,
    );
    const updated = await getAnnouncement(announceId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'announcement.update',
        targetType: 'announcement',
        targetId: announceId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteAnnouncement(
    announceId: string,
    actor: AuditActor,
): Promise<void> {
    const before = await getAnnouncement(announceId);

    const result = (await query(
        `DELETE FROM announcements WHERE announce_id = ?`,
        [announceId],
    )) as { affectedRows: number };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('공지를 찾을 수 없습니다.', 'ANNOUNCEMENT_NOT_FOUND');
    }

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'announcement.delete',
        targetType: 'announcement',
        targetId: announceId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
