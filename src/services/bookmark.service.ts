import { query } from '../config/database';
import { BookmarkType } from '../types';

export type StoreBookmarkResponse = {
    bookmarkId: string;
    targetId: string;
    type: 'store';
    createdAt: Date;
    store: {
        name: string;
        address: string;
        imageUrl: string | null;
        rating: number;
    };
};

export type ProductBookmarkResponse = {
    bookmarkId: string;
    targetId: string;
    type: 'product';
    createdAt: Date;
    product: {
        name: string;
        minPrice: number;
        maxPrice: number;
        imageUrl: string | null;
        category: string | null;
    };
};

export async function addBookmark(userId: string, targetId: string, type: BookmarkType) {
    await query(
        `INSERT IGNORE INTO bookmarks (user_id, target_id, type) VALUES (?, ?, ?)`,
        [userId, targetId, type],
    );
}

export async function deleteBookmark(userId: string, targetId: string, type: BookmarkType) {
    await query(
        'DELETE FROM bookmarks WHERE user_id = ? AND target_id = ? AND type = ?',
        [userId, targetId, type],
    );
}

export async function getStoreBookmarks(userId: string): Promise<StoreBookmarkResponse[]> {
    const sql = `
        SELECT b.bookmark_id, b.target_id, b.created_at,
               s.name, s.address, s.image_url, s.rating
        FROM bookmarks b
        JOIN stores s ON b.target_id = s.store_id
        WHERE b.user_id = ? AND b.type = 'store'
        ORDER BY b.created_at DESC
    `;
    const rows = await query<
        Array<{
            bookmark_id: string;
            target_id: string;
            created_at: Date;
            name: string;
            address: string;
            image_url: string | null;
            rating: number;
        }>
    >(sql, [userId]);

    return rows.map((row) => ({
        bookmarkId: row.bookmark_id,
        targetId: row.target_id,
        type: 'store',
        createdAt: row.created_at,
        store: {
            name: row.name,
            address: row.address,
            imageUrl: row.image_url,
            rating: row.rating,
        },
    }));
}

export async function getProductBookmarks(userId: string): Promise<ProductBookmarkResponse[]> {
    const sql = `
        SELECT b.bookmark_id, b.target_id, b.created_at,
               p.product_name, p.min_price, p.max_price, p.image_url, p.category
        FROM bookmarks b
        JOIN products p ON b.target_id = p.product_id
        WHERE b.user_id = ? AND b.type = 'product'
        ORDER BY b.created_at DESC
    `;
    const rows = await query<
        Array<{
            bookmark_id: string;
            target_id: string;
            created_at: Date;
            product_name: string;
            min_price: number;
            max_price: number;
            image_url: string | null;
            category: string | null;
        }>
    >(sql, [userId]);

    return rows.map((row) => ({
        bookmarkId: row.bookmark_id,
        targetId: row.target_id,
        type: 'product',
        createdAt: row.created_at,
        product: {
            name: row.product_name,
            minPrice: row.min_price,
            maxPrice: row.max_price,
            imageUrl: row.image_url,
            category: row.category,
        },
    }));
}
