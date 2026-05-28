import { query } from '../config/database';
import { TagRow } from '../types';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';

const TAG_COLUMNS = 'tag_id, name, relation_type, created_at';

export interface AdminTagResponse {
    tagId: string;
    name: string;
    relationType: string | null;
    createdAt: Date;
}

function toAdminTag(row: TagRow): AdminTagResponse {
    return {
        tagId: row.tag_id,
        name: row.name,
        relationType: row.relation_type,
        createdAt: row.created_at,
    };
}

/** 감사 로그 기록에 필요한 행위자 컨텍스트. */
export interface AuditActor {
    adminId: string;
    ip?: string | null;
    userAgent?: string | null;
}

export interface CreateTagParams {
    name: string;
    relationType?: string | null;
}

export type UpdateTagParams = Partial<CreateTagParams>;

async function getTag(tagId: string): Promise<AdminTagResponse> {
    const rows = await query<TagRow[]>(
        `SELECT ${TAG_COLUMNS} FROM tags WHERE tag_id = ?`,
        [tagId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('태그를 찾을 수 없습니다.', 'TAG_NOT_FOUND');
    }
    return toAdminTag(rows[0]);
}

export async function listTagsForAdmin(params: {
    q?: string;
    relationType?: string;
    page: number;
    limit: number;
}) {
    const offset = (params.page - 1) * params.limit;

    const whereParts: string[] = [];
    const whereArgs: Array<string> = [];
    if (params.q) {
        whereParts.push('name LIKE ?');
        whereArgs.push(`%${params.q}%`);
    }
    if (params.relationType) {
        whereParts.push('relation_type = ?');
        whereArgs.push(params.relationType);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM tags ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<TagRow[]>(
        `SELECT ${TAG_COLUMNS} FROM tags ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );
    return {
        items: rows.map(toAdminTag),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function createTag(
    params: CreateTagParams,
    actor: AuditActor,
): Promise<AdminTagResponse> {
    // tag_id 를 직접 만들어 INSERT 후 같은 ID 로 SELECT (UUID() 컬럼 기본값 우회).
    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const tagId = idRows[0]?.id;
    if (!tagId) {
        throw new Error('UUID 생성 실패');
    }

    await query(
        `INSERT INTO tags (tag_id, name, relation_type) VALUES (?, ?, ?)`,
        [tagId, params.name, params.relationType ?? null],
    );
    const created = await getTag(tagId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'tag.create',
        targetType: 'tag',
        targetId: tagId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateTag(
    tagId: string,
    params: UpdateTagParams,
    actor: AuditActor,
): Promise<AdminTagResponse> {
    const before = await getTag(tagId);

    const fields: string[] = [];
    const args: Array<string | null> = [];
    if (params.name !== undefined) {
        fields.push('name = ?');
        args.push(params.name);
    }
    if (params.relationType !== undefined) {
        fields.push('relation_type = ?');
        args.push(params.relationType ?? null);
    }
    if (fields.length === 0) {
        return before;
    }

    args.push(tagId);
    await query(`UPDATE tags SET ${fields.join(', ')} WHERE tag_id = ?`, args);
    const updated = await getTag(tagId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'tag.update',
        targetType: 'tag',
        targetId: tagId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteTag(tagId: string, actor: AuditActor): Promise<void> {
    const before = await getTag(tagId);

    const result = (await query(`DELETE FROM tags WHERE tag_id = ?`, [tagId])) as {
        affectedRows: number;
    };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('태그를 찾을 수 없습니다.', 'TAG_NOT_FOUND');
    }

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'tag.delete',
        targetType: 'tag',
        targetId: tagId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
