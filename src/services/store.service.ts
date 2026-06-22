import { query } from '../config/database';
import { StoreRow } from '../types';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './admin.service';
import type { AuditActor } from './adminTag.service';

const STORE_COLUMNS = `
    store_id, name, address, lat, lon, phone, description,
    image_url, opening_hours, rating, created_at, updated_at
`;

export type StoreResponse = {
    storeId: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    phone: string | null;
    description: string | null;
    imageUrl: string | null;
    openingHours: string | null;
    rating: number;
    createdAt: Date;
    updatedAt: Date;
};

function toStoreResponse(row: StoreRow): StoreResponse {
    return {
        storeId: row.store_id,
        name: row.name,
        address: row.address,
        lat: row.lat,
        lon: row.lon,
        phone: row.phone,
        description: row.description,
        imageUrl: row.image_url,
        openingHours: row.opening_hours,
        rating: row.rating,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function getNearStoreList(lat: number, lon: number, radiusKm: number) {
    const sql = `
        SELECT ${STORE_COLUMNS},
            (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(lat)) *
                COS(RADIANS(lon) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(lat))
            )) AS distance
        FROM stores
        HAVING distance <= ?
        ORDER BY distance ASC
        LIMIT 50
    `;
    const rows = await query<Array<StoreRow & { distance: number }>>(
        sql,
        [lat, lon, lat, radiusKm],
    );
    return rows.map((row) => ({ ...toStoreResponse(row), distance: row.distance }));
}

export async function getStore(storeId: string) {
    const rows = await query<StoreRow[]>(
        `SELECT ${STORE_COLUMNS} FROM stores WHERE store_id = ?`,
        [storeId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('매장을 찾을 수 없습니다.', 'STORE_NOT_FOUND');
    }
    return toStoreResponse(rows[0]);
}

// ────────────────────────────────────────────────────────────────
// Admin: 매장 CRUD
// ────────────────────────────────────────────────────────────────

export interface CreateStoreParams {
    name: string;
    address: string;
    lat: number;
    lon: number;
    phone?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    openingHours?: string | null;
    rating?: number;
}

export interface UpdateStoreParams {
    name?: string;
    address?: string;
    lat?: number;
    lon?: number;
    phone?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    openingHours?: string | null;
    rating?: number;
}

export async function listStoresForAdmin(params: { q?: string; page: number; limit: number }) {
    const offset = (params.page - 1) * params.limit;
    const where = params.q ? `WHERE name LIKE ? OR address LIKE ?` : '';
    const args: Array<string | number> = [];
    if (params.q) {
        const kw = `%${params.q}%`;
        args.push(kw, kw);
    }

    const countRows = await query<Array<{ total: bigint | number }>>(
        `SELECT COUNT(*) AS total FROM stores ${where}`,
        args,
    );
    // MariaDB COUNT(*) 는 BigInt 를 반환 — Number 로 캐스팅하지 않으면 Math.ceil(BigInt/number) 가 TypeError.
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<StoreRow[]>(
        `SELECT ${STORE_COLUMNS} FROM stores ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, params.limit, offset],
    );
    return {
        items: rows.map(toStoreResponse),
        pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit),
        },
    };
}

export async function createStore(params: CreateStoreParams, actor: AuditActor) {
    // store_id 를 직접 만들어 두면 INSERT 후 같은 ID 로 SELECT 가능 (UUID() 컬럼 기본값 우회).
    const idRows = await query<Array<{ id: string }>>('SELECT UUID() AS id', []);
    const storeId = idRows[0]?.id;
    if (!storeId) {
        throw new Error('UUID 생성 실패');
    }

    await query(
        `INSERT INTO stores (store_id, name, address, lat, lon, phone, description, image_url, opening_hours, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            storeId,
            params.name,
            params.address,
            params.lat,
            params.lon,
            params.phone ?? null,
            params.description ?? null,
            params.imageUrl ?? null,
            params.openingHours ?? null,
            params.rating ?? 0,
        ],
    );
    const created = await getStore(storeId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store.create',
        targetType: 'store',
        targetId: storeId,
        diff: { after: created },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return created;
}

export async function updateStore(
    storeId: string,
    params: UpdateStoreParams,
    actor: AuditActor,
) {
    // before 를 먼저 확보. 존재 여부도 동시에 확인되어 UPDATE 가 무손실로 진행된다.
    const before = await getStore(storeId);

    const fields: string[] = [];
    const args: Array<string | number | null> = [];

    const fieldMap: Array<[keyof UpdateStoreParams, string]> = [
        ['name', 'name'],
        ['address', 'address'],
        ['lat', 'lat'],
        ['lon', 'lon'],
        ['phone', 'phone'],
        ['description', 'description'],
        ['imageUrl', 'image_url'],
        ['openingHours', 'opening_hours'],
        ['rating', 'rating'],
    ];
    for (const [key, column] of fieldMap) {
        const value = params[key];
        if (value !== undefined) {
            fields.push(`${column} = ?`);
            args.push(value as string | number | null);
        }
    }
    // 변경할 필드가 없으면 no-op. tag/announcement 와 동일하게 감사 로그도 남기지 않는다.
    if (fields.length === 0) {
        return before;
    }

    args.push(storeId);
    const result = (await query(
        `UPDATE stores SET ${fields.join(', ')} WHERE store_id = ?`,
        args,
    )) as { affectedRows: number };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('매장을 찾을 수 없습니다.', 'STORE_NOT_FOUND');
    }
    const updated = await getStore(storeId);

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store.update',
        targetType: 'store',
        targetId: storeId,
        diff: { before, after: updated },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
    return updated;
}

export async function deleteStore(storeId: string, actor: AuditActor) {
    // before 스냅샷을 먼저 확보해 감사 로그에 삭제 직전 상태를 남긴다.
    const before = await getStore(storeId);

    const result = (await query(
        `DELETE FROM stores WHERE store_id = ?`,
        [storeId],
    )) as { affectedRows: number };
    if (Number(result.affectedRows) === 0) {
        throw new NotFoundError('매장을 찾을 수 없습니다.', 'STORE_NOT_FOUND');
    }

    await writeAuditLog({
        adminId: actor.adminId,
        action: 'store.delete',
        targetType: 'store',
        targetId: storeId,
        diff: { before },
        ip: actor.ip,
        userAgent: actor.userAgent,
    });
}

export async function getStoreGachaList(productId: string) {
    // gotcha-map-policy §5 (옵션 A): 원본(카탈로그 store_products) + 매장 추가본(store_product_overrides)을
    // 함께 노출한다. 원본 먼저, 매장 추가본을 뒤에 둔다. source 로 프론트가 구분한다.
    const catalogSql = `
        SELECT s.store_id, s.name, s.address, s.lat, s.lon, s.phone, s.description,
               s.image_url, s.opening_hours, s.rating, s.created_at, s.updated_at,
               sp.price, sp.stock
        FROM store_products sp
        JOIN stores s ON sp.store_id = s.store_id
        WHERE sp.product_id = ?
        ORDER BY sp.price ASC
    `;
    const overrideSql = `
        SELECT s.store_id, s.name, s.address, s.lat, s.lon, s.phone, s.description,
               s.image_url, s.opening_hours, s.rating, s.created_at, s.updated_at,
               o.price, o.stock
        FROM store_product_overrides o
        JOIN stores s ON o.store_id = s.store_id
        WHERE o.product_id = ?
        ORDER BY o.price ASC
    `;
    const [catalogRows, overrideRows] = await Promise.all([
        query<Array<StoreRow & { price: number; stock: number | null }>>(catalogSql, [productId]),
        query<Array<StoreRow & { price: number; stock: number | null }>>(overrideSql, [productId]),
    ]);

    return [
        ...catalogRows.map((row) => ({
            ...toStoreResponse(row),
            price: row.price,
            stock: row.stock,
            source: 'catalog' as const,
        })),
        ...overrideRows.map((row) => ({
            ...toStoreResponse(row),
            price: row.price,
            stock: row.stock,
            source: 'store' as const,
        })),
    ];
}

// 한 매장이 취급하는 상품 목록 (소비자 매장 상세용). gotcha-map-policy §5 옵션 A:
// 카탈로그(store_products⋈products) + 매장 추가본(store_product_overrides)을 함께 반환한다.
// 응답은 소비자 product 카드와 호환되도록 minPrice/maxPrice = 매장 가격으로 채운다.
export async function getStoreCatalog(storeId: string) {
    await getStore(storeId); // 존재 검증 (없으면 STORE_NOT_FOUND)

    const catalogSql = `
        SELECT p.product_id, p.product_name, p.product_manufacturer, p.product_info,
               p.category, p.image_url, p.is_new, p.is_popular, p.gender_target,
               sp.price, sp.stock
        FROM store_products sp
        JOIN products p ON p.product_id = sp.product_id
        WHERE sp.store_id = ?
        ORDER BY sp.updated_at DESC
    `;
    const overrideSql = `
        SELECT override_id, product_id, product_name, product_info, image_url, price, stock
        FROM store_product_overrides
        WHERE store_id = ?
        ORDER BY updated_at DESC
    `;

    interface CatalogJoinRow {
        product_id: string;
        product_name: string;
        product_manufacturer: string | null;
        product_info: string | null;
        category: string | null;
        image_url: string | null;
        is_new: boolean;
        is_popular: boolean;
        gender_target: 'M' | 'F' | 'ALL';
        price: number;
        stock: number | null;
    }
    interface OverrideCardRow {
        override_id: string;
        product_id: string | null;
        product_name: string;
        product_info: string | null;
        image_url: string | null;
        price: number;
        stock: number | null;
    }

    const [catalogRows, overrideRows] = await Promise.all([
        query<CatalogJoinRow[]>(catalogSql, [storeId]),
        query<OverrideCardRow[]>(overrideSql, [storeId]),
    ]);

    const catalog = catalogRows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        productManufacturer: r.product_manufacturer,
        productInfo: r.product_info,
        category: r.category,
        imageUrl: r.image_url,
        isNew: Boolean(r.is_new),
        isPopular: Boolean(r.is_popular),
        genderTarget: r.gender_target,
        minPrice: r.price,
        maxPrice: r.price,
        price: r.price,
        stock: r.stock,
        source: 'catalog' as const,
    }));
    const overrides = overrideRows.map((r) => ({
        // productId 가 null(매장 신규 상품)이면 override_id 를 카드 키로 사용.
        productId: r.product_id ?? r.override_id,
        productName: r.product_name,
        productManufacturer: null,
        productInfo: r.product_info,
        category: null,
        imageUrl: r.image_url,
        isNew: false,
        isPopular: false,
        genderTarget: 'ALL' as const,
        minPrice: r.price,
        maxPrice: r.price,
        price: r.price,
        stock: r.stock,
        source: 'store' as const,
    }));

    return [...catalog, ...overrides];
}
