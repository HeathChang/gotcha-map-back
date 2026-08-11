import mariadb from 'mariadb';
import { env } from './env';

const pool = mariadb.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 10,
    acquireTimeout: 30000,
    // H3: 한글/이모지 콘텐츠 손상 방지 — 연결도 utf8mb4 로 고정(테이블 charset 은 마이그레이션에서 명시).
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
});

export async function getConnection(): Promise<mariadb.PoolConnection> {
    return pool.getConnection();
}

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    let conn: mariadb.PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(sql, params);
        return result as T;
    } finally {
        if (conn) conn.release();
    }
}

export async function withTransaction<T>(
    fn: (conn: mariadb.PoolConnection) => Promise<T>,
): Promise<T> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        try {
            await conn.rollback();
        } catch {
            /* ignore rollback failure */
        }
        throw err;
    } finally {
        conn.release();
    }
}

export default pool;
