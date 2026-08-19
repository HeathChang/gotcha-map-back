import { query } from '../config/database';
import { ProductRow, FilterType } from '../types';
import { NotFoundError } from '../utils/errors';

const PRODUCT_COLUMNS = `
    p.product_id, p.product_name, p.product_manufacturer, p.product_info,
    p.category, p.min_price, p.max_price, p.image_url, p.view_count,
    p.is_new, p.is_popular, p.gender_target, p.created_at, p.updated_at
`;

const PRODUCT_COLUMNS_BARE = PRODUCT_COLUMNS.replace(/p\./g, '');

type ListParams = {
    keyword?: string;
    category?: string;
    filter?: FilterType[];
    page?: number;
    limit?: number;
    sortBy?: string;
};

export type ProductResponse = {
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
    createdAt: Date;
    updatedAt: Date;
};

function toProductResponse(row: ProductRow): ProductResponse {
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
        // H5: is_new/is_popular 는 TINYINT(0/1) → 소비자 뱃지 로직(=== true)용으로 boolean 정규화.
        isNew: Boolean(row.is_new),
        isPopular: Boolean(row.is_popular),
        genderTarget: row.gender_target,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildFilterClause(params: Pick<ListParams, 'keyword' | 'category' | 'filter'>): {
    where: string;
    values: unknown[];
} {
    let where = 'WHERE 1=1';
    const values: unknown[] = [];

    if (params.keyword) {
        where += ' AND (p.product_name LIKE ? OR p.product_info LIKE ?)';
        const kw = `%${params.keyword}%`;
        values.push(kw, kw);
    }
    if (params.category) {
        where += ' AND p.category = ?';
        values.push(params.category);
    }
    if (params.filter?.includes('FEMALE')) where += " AND p.gender_target IN ('F','ALL')";
    if (params.filter?.includes('MALE')) where += " AND p.gender_target IN ('M','ALL')";
    if (params.filter?.includes('NEW')) where += ' AND p.is_new = TRUE';
    if (params.filter?.includes('POPULAR')) where += ' AND p.is_popular = TRUE';

    return { where, values };
}

function resolveOrderBy(sortBy?: string): string {
    switch (sortBy) {
        case 'popular':
            return 'ORDER BY p.view_count DESC';
        case 'price_asc':
            return 'ORDER BY p.min_price ASC';
        case 'price_desc':
            return 'ORDER BY p.max_price DESC';
        case 'new':
        default:
            return 'ORDER BY p.created_at DESC';
    }
}

async function listProducts(params: ListParams) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const { where, values } = buildFilterClause(params);
    const orderBy = resolveOrderBy(params.sortBy);

    const [countResult, rows] = await Promise.all([
        query<Array<{ cnt: number }>>(
            `SELECT COUNT(*) AS cnt FROM products p ${where}`,
            values,
        ),
        query<ProductRow[]>(
            `SELECT ${PRODUCT_COLUMNS} FROM products p ${where} ${orderBy} LIMIT ? OFFSET ?`,
            [...values, limit, offset],
        ),
    ]);
    const totalCount = Number(countResult[0].cnt);

    return {
        products: rows.map(toProductResponse),
        pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    };
}

export async function getProducts(params: Omit<ListParams, 'keyword'>) {
    return listProducts(params);
}

export async function searchProducts(params: ListParams) {
    return listProducts(params);
}

export async function getProductDetail(productId: string) {
    const rows = await query<ProductRow[]>(
        `SELECT ${PRODUCT_COLUMNS_BARE} FROM products WHERE product_id = ?`,
        [productId],
    );
    if (rows.length === 0) {
        throw new NotFoundError('상품을 찾을 수 없습니다.', 'PRODUCT_NOT_FOUND');
    }

    // 존재 확인 후에만 조회수 증가. (존재하지 않는 id에 대한 낭비 UPDATE 방지)
    const [images, tags] = await Promise.all([
        query<Array<{ image_url: string }>>(
            'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order',
            [productId],
        ),
        query<Array<{ name: string }>>(
            `SELECT t.name FROM product_tags pt JOIN tags t ON pt.tag_id = t.tag_id WHERE pt.product_id = ?`,
            [productId],
        ),
        query('UPDATE products SET view_count = view_count + 1 WHERE product_id = ?', [productId]),
    ]);

    return {
        ...toProductResponse(rows[0]),
        detailImages: images.map((i) => i.image_url),
        tags: tags.map((t) => t.name),
    };
}

function whereForFilter(filter: FilterType): string {
    switch (filter) {
        case 'FEMALE':
            return "WHERE gender_target IN ('F','ALL')";
        case 'MALE':
            return "WHERE gender_target IN ('M','ALL')";
        case 'NEW':
            return 'WHERE is_new = TRUE';
        case 'POPULAR':
            return 'WHERE is_popular = TRUE';
    }
}

export async function getMainProductsList(filters: FilterType[]) {
    const lists = await Promise.all(
        filters.map((filter) =>
            query<ProductRow[]>(
                `SELECT ${PRODUCT_COLUMNS_BARE} FROM products ${whereForFilter(filter)} ORDER BY created_at DESC LIMIT 10`,
            ).then((rows) => [filter, rows.map(toProductResponse)] as const),
        ),
    );

    const result: Record<string, ProductResponse[]> = {};
    for (const [filter, items] of lists) result[filter] = items;
    return result;
}
