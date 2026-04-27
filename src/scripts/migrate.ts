import { promises as fs } from 'node:fs';
import path from 'node:path';
import pool from '../config/database';
import { logger } from '../utils/logger';
import { parseMigrationFile, splitStatements } from './migrationUtils';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../sql/migrations');

async function ensureMigrationTable(): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version    VARCHAR(64) PRIMARY KEY,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);
    } finally {
        conn.release();
    }
}

async function loadAppliedVersions(): Promise<Set<string>> {
    const conn = await pool.getConnection();
    try {
        const rows = (await conn.query('SELECT version FROM schema_migrations')) as Array<{
            version: string;
        }>;
        return new Set(rows.map((r) => r.version));
    } finally {
        conn.release();
    }
}

async function listMigrationFiles(): Promise<Array<{ version: string; file: string }>> {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    const valid = entries
        .map(parseMigrationFile)
        .filter((m): m is { version: string; file: string } => m !== null);
    valid.sort((a, b) => a.version.localeCompare(b.version));
    return valid;
}

async function applyMigration(version: string, file: string): Promise<void> {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = await fs.readFile(fullPath, 'utf8');
    const statements = splitStatements(sql);

    const conn = await pool.getConnection();
    try {
        // DDL은 MariaDB에서 자동 커밋되므로 트랜잭션이 보장되지 않음.
        // 실패 시 운영자가 수동 복구해야 한다는 점을 로깅으로 명확히 함(database.md).
        for (const stmt of statements) {
            await conn.query(stmt);
        }
        await conn.query(
            'INSERT INTO schema_migrations (version) VALUES (?)',
            [version],
        );
        logger.info('migration.applied', { version, file });
    } catch (err) {
        logger.error('migration.failed', { version, file, err });
        throw err;
    } finally {
        conn.release();
    }
}

async function main(): Promise<void> {
    logger.info('migration.start', { dir: MIGRATIONS_DIR });

    await ensureMigrationTable();
    const [applied, all] = await Promise.all([loadAppliedVersions(), listMigrationFiles()]);

    const pending = all.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
        logger.info('migration.up_to_date', { totalApplied: applied.size });
    } else {
        logger.info('migration.pending', {
            count: pending.length,
            versions: pending.map((m) => m.version),
        });
        for (const m of pending) {
            await applyMigration(m.version, m.file);
        }
    }

    await pool.end();
}

if (require.main === module) {
    main().catch(async (err) => {
        logger.error('migration.fatal', { err });
        try {
            await pool.end();
        } catch {
            /* ignore */
        }
        process.exit(1);
    });
}
