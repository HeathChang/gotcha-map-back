import { query, withTransaction } from '../config/database';
import { ProductRow } from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './admin.service';
import type { AuditActor } from './adminTag.service';

const PRODUCT_COLUMNS = [
    'product_id',
    'product_name',
    'product_manufacturer',
    'product_info',
    'category',
    'min_price',
    'max_price',
    'image_url',
    'view_count',
    'is_new',
    'is_popular',
    'gender_target',
    'created_at',
    'updated_at',
].join(', ');

// 목록은 lean — 갤러리/태그는 detail 에서. tag_count/image_count 만 서브쿼리로 노출.
const PRODUCT_LIST_COLUMNS = `
    p.product_id, p.product_name, p.product_manufacturer, p.product_info,
    p.category, p.min_price, p.max_price, p.image_url, p.view_count,
    p.is_new, p.is_popular, p.gender_target, p.created_at, p.updated_at,
    (SELECT COUNT(*) FROM product_tags pt WHERE pt.product_id = p.product_id) AS tag_count,
    (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.product_id) AS image_count
`;

export interface AdminProductListItem {
    productId: string;
    productName: string;
    productManufacturer: string | null;
    productInfo: string | null;
    category: string | null;
    minPrice: number;
    maxPrice: number;
    imageUrl: string | null;
    viewCount: number;
    isNew: boolean;
    isPopular: boolean;
    genderTarget: 'M' | 'F' | 'ALL';
    tagCount: number;
    imageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface AdminProductTag {
    tagId: string;
    name: string;
    relationType: string | null;
}

export interface AdminProductDetail {
    productId: string;
    productName: string;
    productManufacturer: string | null;
    productInfo: string | null;
    category: string | null;
    minPrice: number;
    maxPrice: number;
    imageUrl: string | null;
    viewCount: number;
    isNew: boolean;
    isPopular: boolean;
    genderTarget: 'M' | 'F' | 'ALL';
    /** 갤러리 이미지 URL (sort_order 오름차순). */
    images: string[];
    /** 연결된 태그 (tag_id, name, relation_type). */
    tags: AdminProductTag[];
    createdAt: Date;
    updatedAt: Date;
}

interface ProductListRow extends ProductRow {
    tag_count: number | bigint;
    image_count: number | bigint;
}

function toListItem(row: ProductListRow): AdminProductListItem {
    return {
        productId: row.product_id,
        productName: row.product_name,
        productManufacturer: row.product_manufacturer,
        productInfo: row.product_info,
        category: row.category,
        minPrice: row.min_price,
        maxPrice: row.max_price,
        imageUrl: row.image_url,
        viewCount: row.view_count,
        isNew: Boolean(row.is_new),
        isPopular: Boolean(row.is_popular),
        genderTarget: row.gender_target,
        tagCount: Number(row.tag_count),
        imageCount: Number(row.image_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toDetailBase(row: ProductRow): Omit<AdminProductDetail, 'images' | 'tags'> {
    return {
        productId: row.product_id,
        productName: row.product_name,
        productManufacturer: row.product_manufacturer,
        productInfo: row.product_info,
        category: row.category,
        minPrice: row.min_price,
        maxPrice: row.max_price,
        imageUrl: row.image_url,
        viewCount: row.view_count,
        isNew: Boolean(row.is_new),
        isPopular: Boolean(row.is_popular),
        genderTarget: row.gender_target,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface CreateProductParams {
    productName: string;
    productManufacturer?: string | null;
    productInfo?: string | null;
    category?: string | null;
    minPrice: number;
    maxPrice: number;
    imageUrl?: string | null;
    isNew?: boolean;
    isPopular?: boolean;
    genderTarget?: 'M' | 'F' | 'ALL';
    images?: string[];
    tagIds?: string[];
}

export type UpdateProductParams = Partial<CreateProductParams>;

// ────────────────────────────────────────────────────────────────
// 내부 헬퍼
// ────────────────────────────────────────────────────────────────

/** 태그 ID 가 모두 존재하는지 검증. 누락 시 ValidationError. */
async function assertTagsExist(tagIds: ReadonlyArray<string>): Promise<void> {
    if (tagIds.length === 0) return;
    const placeholders = tagIds.map(() => '?').join(', ');
    const rows = await query<Array<{ tag_id: string }>>(
        `SELECT tag_id FROM tags WHERE tag_id IN (${placeholders})`,
        [...tagIds],
    );
    const found = new Set(rows.map((r) => r.tag_id));
    const missing = tagIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
        throw new ValidationError(
            `존재하지 않는 태그 ID: ${missing.join(', ')}`,
            'TAG_NOT_FOUND',
        );
    }
}

async function loadImagesForProduct(productId: string): Promise<string[]> {
    const rows = await query<Array<{ image_url: string }>>(
        `SELECT image_url FROM product_images
         WHERE product_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
        [productId],
    );
    return rows.map((r) => r.image_url);
}

async function loadTagsForProduct(productId: string): Promise<AdminProductTag[]> {
    const rows = await query<
        Array<{ tag_id: string; name: string; relation_type: string | null }>
    >(
        `SELECT t.tag_id, t.name, t.relation_type
         FROM product_tags pt
         JOIN tags t ON t.tag_id = pt.tag_id
         WHERE pt.product_id = ?
         ORDER BY t.name ASC`,
        [productId],
    );
    return rows.map((r) => ({
        tagId: r.tag_id,
        name: r.name,
        relationType: r.relation_type,
    }));
}

export async function getProductDetail(productId: string): Promise<AdminProductDetail> {
    const rows = await query<ProductRow[]>(
        `SELECT ${PRODUCT_COLUMNS} FROM products WHERE product_id = ?`,
        [productId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('제품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
    }
    const base = toDetailBase(rows[0]);
    const [images, tags] = await Promise.all([
        loadImagesForProduct(productId),
        loadTagsForProduct(productId),
    ]);
    return { ...base, images, tags };
}

// ────────────────────────────────────────────────────────────────
// 목록 / CRUD
// ────────────────────────────────────────────────────────────────

export async function listProductsForAdmin(params: {
    q?: string;
    category?: string;
    isNew?: boolean;
    isPopular?: boolean;
    genderTarget?: 'M' | 'F' | 'ALL';
    page: number;
    limit: number;
}) {
    const offset = (params.page - 1) * params.limit;

    const whereParts: string[] = [];
    const whereArgs: Array<string | number> = [];
    if (params.q) {
        whereParts.push('p.product_name LIKE ?');
        whereArgs.push(`%${params.q}%`);
    }
    if (params.category) {
        whereParts.push('p.category = ?');
        whereArgs.push(params.category);
    }
    if (params.isNew !== undefined) {
        whereParts.push('p.is_new = ?');
        whereArgs.push(params.isNew ? 1 : 0);
    }
    if (params.isPopular !== undefined) {
        whereParts.push('p.is_popular = ?');
        whereArgs.push(params.isPopular ? 1 : 0);
    }
    if (params.genderTarget) {
        whereParts.push('p.gender_target = ?');
        whereArgs.push(params.genderTarget);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
        whereArgs,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<ProductListRow[]>(
        `SELECT ${PRODUCT_LIST_COLUMNS}
         FROM products p
         ${whereSql}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, params.limit, offset],
    );

    return {
        items: rows.map(toListItem),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function createProduct(
    params: CreateProductParams,
    actor: AuditActor,
): Promise<AdminProductDetail> {
    if (params.tagIds && params.tagIds.length > 0) {
        await assertTagsExist(params.tagIds);
    }

    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const productId = idRows[0]?.id;
    if (!productId) {
        throw new Error('UUID 생성 실패');
    }

    await withTransaction(async (conn) => {
        await conn.query(
            `INSERT INTO products
                (product_id, product_name, product_manufacturer, product_info, category,
                 min_price, max_price, image_url, is_new, is_popular, gender_target)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productId,
                params.productName,
                params.productManufacturer ?? null,
                params.productInfo ?? null,
                params.category ?? null,
                params.minPrice,
                params.maxPrice,
                params.imageUrl ?? null,
                params.isNew ? 1 : 0,
                params.isPopular ? 1 : 0,
                params.genderTarget ?? 'ALL',
            ],
        );

        if (params.images && params.images.length > 0) {
            // 다중 INSERT — UUID 와 sort_order 부여.
            const values = params.images.map((url, idx) => [productId, url, idx]);
            for (const v of values) {
                await conn.query(
                    `INSERT INTO product_images (product_id, image_url, sort_order)
                     VALUES (?, ?, ?)`,
                    v,
                );
            }
        }

        if (params.tagIds && params.tagIds.length > 0) {
            for (const tagId of params.tagIds) {
                await conn.query(
                    `INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)`,
                    [productId, tagId],
                );
            }
        }
    });

    const created = await getProductDetail(productId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'product.create',
        targetType: 'product',
        targetId: productId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateProduct(
    productId: string,
    params: UpdateProductParams,
    actor: AuditActor,
): Promise<AdminProductDetail> {
    const before = await getProductDetail(productId);

    if (params.tagIds && params.tagIds.length > 0) {
        await assertTagsExist(params.tagIds);
    }

    // 부분 업데이트 필드 맵.
    const fieldMap: Array<[keyof UpdateProductParams, string]> = [
        ['productName', 'product_name'],
        ['productManufacturer', 'product_manufacturer'],
        ['productInfo', 'product_info'],
        ['category', 'category'],
        ['minPrice', 'min_price'],
        ['maxPrice', 'max_price'],
        ['imageUrl', 'image_url'],
        ['isNew', 'is_new'],
        ['isPopular', 'is_popular'],
        ['genderTarget', 'gender_target'],
    ];
    const fields: string[] = [];
    const args: Array<string | number | null> = [];
    for (const [key, column] of fieldMap) {
        const value = params[key];
        if (value === undefined) continue;
        fields.push(`${column} = ?`);
        if (typeof value === 'boolean') {
            args.push(value ? 1 : 0);
        } else {
            args.push(value as string | number | null);
        }
    }

    const hasImageChange = params.images !== undefined;
    const hasTagChange = params.tagIds !== undefined;

    // 아무 변경도 없으면 no-op + 감사 미기록.
    if (fields.length === 0 && !hasImageChange && !hasTagChange) {
        return before;
    }

    await withTransaction(async (conn) => {
        if (fields.length > 0) {
            const result = (await conn.query(
                `UPDATE products SET ${fields.join(', ')} WHERE product_id = ?`,
                [...args, productId],
            )) as { affectedRows: number };
            if (Number(result.affectedRows) === 0) {
                throw new NotFoundError('제품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
            }
        }

        if (hasImageChange) {
            // 전체 교체: 기존 product_images 삭제 후 재삽입.
            await conn.query(`DELETE FROM product_images WHERE product_id = ?`, [productId]);
            const images = params.images ?? [];
            for (let i = 0; i < images.length; i++) {
                await conn.query(
                    `INSERT INTO product_images (product_id, image_url, sort_order)
                     VALUES (?, ?, ?)`,
                    [productId, images[i], i],
                );
            }
        }

        if (hasTagChange) {
            await conn.query(`DELETE FROM product_tags WHERE product_id = ?`, [productId]);
            const tagIds = params.tagIds ?? [];
            for (const tagId of tagIds) {
                await conn.query(
                    `INSERT INTO product_tags (product_id, tag_id) VALUES (?, ?)`,
                    [productId, tagId],
                );
            }
        }
    });

    const updated = await getProductDetail(productId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'product.update',
        targetType: 'product',
        targetId: productId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteProduct(productId: string, actor: AuditActor): Promise<void> {
    const before = await getProductDetail(productId);

    const result = (await query(
        `DELETE FROM products WHERE product_id = ?`,
        [productId],
    )) as { affectedRows: number };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('제품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
    }
    // product_images / product_tags / store_products 는 FK CASCADE 로 자동 정리.

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'product.delete',
        targetType: 'product',
        targetId: productId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
