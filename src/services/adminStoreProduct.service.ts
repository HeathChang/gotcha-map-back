/**
 * 어드민 매장 가격·재고(store_products) + 매장별 카탈로그 오버라이드(store_product_overrides).
 * gotcha-map-policy §4·§5. 소유권은 라우트의 requireStoreOwnership 가 1차 차단하고,
 * 서비스는 모든 by-id 쿼리에 `AND store_id = ?` 를 붙여 교차-매장 접근을 2차 차단한다.
 */
import { query } from '../config/database';
import { ConflictError, NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';
import { getStore } from './store.service';
import type { AuditActor } from './adminTag.service';

// ── 가격·재고 (store_products) ────────────────────────────────────

export interface AdminStoreProductResponse {
    id: string;
    storeId: string;
    productId: string;
    productName: string;
    productImageUrl: string | null;
    price: number;
    stock: number | null;
    createdAt: Date;
    updatedAt: Date;
}

interface StoreProductJoinRow {
    id: string;
    store_id: string;
    product_id: string;
    product_name: string;
    product_image_url: string | null;
    price: number;
    stock: number | null;
    created_at: Date;
    updated_at: Date;
}

const STORE_PRODUCT_SELECT = `
    SELECT sp.id, sp.store_id, sp.product_id, sp.price, sp.stock,
           sp.created_at, sp.updated_at,
           p.product_name, p.image_url AS product_image_url
    FROM store_products sp
    JOIN products p ON p.product_id = sp.product_id`;

function toStoreProduct(row: StoreProductJoinRow): AdminStoreProductResponse {
    return {
        id: row.id,
        storeId: row.store_id,
        productId: row.product_id,
        productName: row.product_name,
        productImageUrl: row.product_image_url,
        price: row.price,
        stock: row.stock,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function getStoreProductOrThrow(
    storeId: string,
    storeProductId: string,
): Promise<AdminStoreProductResponse> {
    const rows = await query<StoreProductJoinRow[]>(
        `${STORE_PRODUCT_SELECT} WHERE sp.id = ? AND sp.store_id = ?`,
        [storeProductId, storeId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('매장 상품을 찾을 수 없습니다.', 'STORE_PRODUCT_NOT_FOUND');
    }
    return toStoreProduct(rows[0]);
}

export async function listStoreProducts(
    storeId: string,
): Promise<AdminStoreProductResponse[]> {
    await getStore(storeId); // 매장 존재 검증 (없으면 STORE_NOT_FOUND)
    const rows = await query<StoreProductJoinRow[]>(
        `${STORE_PRODUCT_SELECT} WHERE sp.store_id = ? ORDER BY sp.updated_at DESC`,
        [storeId],
    );
    return rows.map(toStoreProduct);
}

export async function createStoreProduct(
    storeId: string,
    params: { productId: string; price: number; stock?: number | null },
    actor: AuditActor,
): Promise<AdminStoreProductResponse> {
    await getStore(storeId);

    const prod = await query<Array<{ product_id: string }>>(
        'SELECT product_id FROM products WHERE product_id = ?',
        [params.productId],
    );
    if (prod.length === 0) {
        throw new NotFoundError('제품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
    }

    const dup = await query<Array<{ id: string }>>(
        'SELECT id FROM store_products WHERE store_id = ? AND product_id = ?',
        [storeId, params.productId],
    );
    if (dup.length > 0) {
        throw new ConflictError(
            '이미 이 매장에 등록된 제품입니다. 수정으로 가격·재고를 변경하세요.',
            'STORE_PRODUCT_EXISTS',
        );
    }

    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const id = idRows[0]?.id;
    if (!id) throw new Error('UUID 생성 실패');

    await query(
        'INSERT INTO store_products (id, store_id, product_id, price, stock) VALUES (?, ?, ?, ?, ?)',
        [id, storeId, params.productId, params.price, params.stock ?? null],
    );
    const created = await getStoreProductOrThrow(storeId, id);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_product.create',
        targetType: 'store_product',
        targetId: id,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateStoreProduct(
    storeId: string,
    storeProductId: string,
    params: { price?: number; stock?: number | null },
    actor: AuditActor,
): Promise<AdminStoreProductResponse> {
    const before = await getStoreProductOrThrow(storeId, storeProductId);

    const fields: string[] = [];
    const args: Array<number | null> = [];
    if (params.price !== undefined) {
        fields.push('price = ?');
        args.push(params.price);
    }
    if (params.stock !== undefined) {
        fields.push('stock = ?');
        args.push(params.stock);
    }
    if (fields.length === 0) return before;

    await query(
        `UPDATE store_products SET ${fields.join(', ')} WHERE id = ? AND store_id = ?`,
        [...args, storeProductId, storeId],
    );
    const updated = await getStoreProductOrThrow(storeId, storeProductId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_product.update',
        targetType: 'store_product',
        targetId: storeProductId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteStoreProduct(
    storeId: string,
    storeProductId: string,
    actor: AuditActor,
): Promise<void> {
    const before = await getStoreProductOrThrow(storeId, storeProductId);
    await query('DELETE FROM store_products WHERE id = ? AND store_id = ?', [
        storeProductId,
        storeId,
    ]);
    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_product.delete',
        targetType: 'store_product',
        targetId: storeProductId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}

// ── 매장별 카탈로그 오버라이드 (store_product_overrides) ────────────

export interface AdminStoreOverrideResponse {
    overrideId: string;
    storeId: string;
    productId: string | null;
    productName: string;
    productInfo: string | null;
    imageUrl: string | null;
    price: number;
    stock: number | null;
    createdByAdminId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface OverrideRow {
    override_id: string;
    store_id: string;
    product_id: string | null;
    product_name: string;
    product_info: string | null;
    image_url: string | null;
    price: number;
    stock: number | null;
    created_by_admin_id: string | null;
    created_at: Date;
    updated_at: Date;
}

const OVERRIDE_COLUMNS =
    'override_id, store_id, product_id, product_name, product_info, image_url, price, stock, created_by_admin_id, created_at, updated_at';

function toOverride(row: OverrideRow): AdminStoreOverrideResponse {
    return {
        overrideId: row.override_id,
        storeId: row.store_id,
        productId: row.product_id,
        productName: row.product_name,
        productInfo: row.product_info,
        imageUrl: row.image_url,
        price: row.price,
        stock: row.stock,
        createdByAdminId: row.created_by_admin_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function getOverrideOrThrow(
    storeId: string,
    overrideId: string,
): Promise<AdminStoreOverrideResponse> {
    const rows = await query<OverrideRow[]>(
        `SELECT ${OVERRIDE_COLUMNS} FROM store_product_overrides WHERE override_id = ? AND store_id = ?`,
        [overrideId, storeId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('카탈로그 항목을 찾을 수 없습니다.', 'STORE_OVERRIDE_NOT_FOUND');
    }
    return toOverride(rows[0]);
}

export interface CreateOverrideParams {
    productId?: string | null;
    productName: string;
    productInfo?: string | null;
    imageUrl?: string | null;
    price?: number;
    stock?: number | null;
}

export async function listStoreOverrides(
    storeId: string,
): Promise<AdminStoreOverrideResponse[]> {
    await getStore(storeId);
    const rows = await query<OverrideRow[]>(
        `SELECT ${OVERRIDE_COLUMNS} FROM store_product_overrides WHERE store_id = ? ORDER BY updated_at DESC`,
        [storeId],
    );
    return rows.map(toOverride);
}

export async function createStoreOverride(
    storeId: string,
    params: CreateOverrideParams,
    actor: AuditActor,
): Promise<AdminStoreOverrideResponse> {
    await getStore(storeId);

    if (params.productId) {
        const prod = await query<Array<{ product_id: string }>>(
            'SELECT product_id FROM products WHERE product_id = ?',
            [params.productId],
        );
        if (prod.length === 0) {
            throw new NotFoundError('제품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
        }
    }

    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const overrideId = idRows[0]?.id;
    if (!overrideId) throw new Error('UUID 생성 실패');

    await query(
        `INSERT INTO store_product_overrides
            (override_id, store_id, product_id, product_name, product_info, image_url, price, stock, created_by_admin_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            overrideId,
            storeId,
            params.productId ?? null,
            params.productName,
            params.productInfo ?? null,
            params.imageUrl ?? null,
            params.price ?? 0,
            params.stock ?? null,
            actor.adminId,
        ],
    );
    const created = await getOverrideOrThrow(storeId, overrideId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_override.create',
        targetType: 'store_override',
        targetId: overrideId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateStoreOverride(
    storeId: string,
    overrideId: string,
    params: Partial<CreateOverrideParams>,
    actor: AuditActor,
): Promise<AdminStoreOverrideResponse> {
    const before = await getOverrideOrThrow(storeId, overrideId);

    const fields: string[] = [];
    const args: Array<string | number | null> = [];
    const set = (col: string, val: string | number | null) => {
        fields.push(`${col} = ?`);
        args.push(val);
    };
    if (params.productId !== undefined) set('product_id', params.productId);
    if (params.productName !== undefined) set('product_name', params.productName);
    if (params.productInfo !== undefined) set('product_info', params.productInfo ?? null);
    if (params.imageUrl !== undefined) set('image_url', params.imageUrl ?? null);
    if (params.price !== undefined) set('price', params.price);
    if (params.stock !== undefined) set('stock', params.stock ?? null);
    if (fields.length === 0) return before;

    await query(
        `UPDATE store_product_overrides SET ${fields.join(', ')} WHERE override_id = ? AND store_id = ?`,
        [...args, overrideId, storeId],
    );
    const updated = await getOverrideOrThrow(storeId, overrideId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_override.update',
        targetType: 'store_override',
        targetId: overrideId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteStoreOverride(
    storeId: string,
    overrideId: string,
    actor: AuditActor,
): Promise<void> {
    const before = await getOverrideOrThrow(storeId, overrideId);
    await query('DELETE FROM store_product_overrides WHERE override_id = ? AND store_id = ?', [
        overrideId,
        storeId,
    ]);
    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store_override.delete',
        targetType: 'store_override',
        targetId: overrideId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}
