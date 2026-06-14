import { query } from '../config/database';
import { BannerRow } from '../types';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';
import type { AuditActor } from './adminTag.service';

const BANNER_COLUMNS =
    'banner_id, title, image_url, link_url, sort_order, is_active, created_at, updated_at';

export interface AdminBannerResponse {
    bannerId: string;
    title: string | null;
    imageUrl: string;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function toAdminBanner(row: BannerRow): AdminBannerResponse {
    return {
        bannerId: row.banner_id,
        title: row.title,
        imageUrl: row.image_url,
        linkUrl: row.link_url,
        sortOrder: Number(row.sort_order),
        // mariadb 는 BOOLEAN 을 0/1 로 돌려주므로 명시적으로 boolean 화한다.
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface CreateBannerParams {
    imageUrl: string;
    title?: string;
    linkUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
}

export type UpdateBannerParams = Partial<CreateBannerParams>;

async function getBanner(bannerId: string): Promise<AdminBannerResponse> {
    const rows = await query<BannerRow[]>(
        `SELECT ${BANNER_COLUMNS} FROM banners WHERE banner_id = ?`,
        [bannerId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('배너를 찾을 수 없습니다.', 'BANNER_NOT_FOUND');
    }
    return toAdminBanner(rows[0]);
}

export async function listBannersForAdmin(params: {
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
        `SELECT COUNT(*) AS total FROM banners ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<BannerRow[]>(
        `SELECT ${BANNER_COLUMNS} FROM banners ${whereSql} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );
    return {
        items: rows.map(toAdminBanner),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function createBanner(
    params: CreateBannerParams,
    actor: AuditActor,
): Promise<AdminBannerResponse> {
    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const bannerId = idRows[0]?.id;
    if (!bannerId) {
        throw new Error('UUID 생성 실패');
    }

    await query(
        `INSERT INTO banners (banner_id, title, image_url, link_url, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            bannerId,
            params.title ?? null,
            params.imageUrl,
            params.linkUrl ?? null,
            params.sortOrder ?? 0,
            (params.isActive ?? true) ? 1 : 0,
        ],
    );
    const created = await getBanner(bannerId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'banner.create',
        targetType: 'banner',
        targetId: bannerId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateBanner(
    bannerId: string,
    params: UpdateBannerParams,
    actor: AuditActor,
): Promise<AdminBannerResponse> {
    const before = await getBanner(bannerId);

    const fields: string[] = [];
    const args: Array<string | number | null> = [];
    if (params.imageUrl !== undefined) {
        fields.push('image_url = ?');
        args.push(params.imageUrl);
    }
    if (params.title !== undefined) {
        fields.push('title = ?');
        args.push(params.title);
    }
    if (params.linkUrl !== undefined) {
        fields.push('link_url = ?');
        args.push(params.linkUrl);
    }
    if (params.sortOrder !== undefined) {
        fields.push('sort_order = ?');
        args.push(params.sortOrder);
    }
    if (params.isActive !== undefined) {
        fields.push('is_active = ?');
        args.push(params.isActive ? 1 : 0);
    }
    if (fields.length === 0) {
        return before;
    }

    args.push(bannerId);
    await query(`UPDATE banners SET ${fields.join(', ')} WHERE banner_id = ?`, args);
    const updated = await getBanner(bannerId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'banner.update',
        targetType: 'banner',
        targetId: bannerId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteBanner(bannerId: string, actor: AuditActor): Promise<void> {
    const before = await getBanner(bannerId);

    const result = (await query(`DELETE FROM banners WHERE banner_id = ?`, [bannerId])) as {
        affectedRows: number;
    };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('배너를 찾을 수 없습니다.', 'BANNER_NOT_FOUND');
    }

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'banner.delete',
        targetType: 'banner',
        targetId: bannerId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
