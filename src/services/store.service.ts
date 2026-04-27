import { query } from '../config/database';
import { StoreRow } from '../types';
import { NotFoundError } from '../utils/errors';

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

export async function getStoreGachaList(productId: string) {
    const sql = `
        SELECT s.store_id, s.name, s.address, s.lat, s.lon, s.phone, s.description,
               s.image_url, s.opening_hours, s.rating, s.created_at, s.updated_at,
               sp.price, sp.stock
        FROM store_products sp
        JOIN stores s ON sp.store_id = s.store_id
        WHERE sp.product_id = ?
        ORDER BY sp.price ASC
    `;
    const rows = await query<Array<StoreRow & { price: number; stock: number | null }>>(sql, [
        productId,
    ]);
    return rows.map((row) => ({
        ...toStoreResponse(row),
        price: row.price,
        stock: row.stock,
    }));
}
