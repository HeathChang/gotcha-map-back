import { promises as fs } from 'node:fs';
import path from 'node:path';
import pool from '../config/database';
import { logger } from '../utils/logger';
import { splitStatements } from './migrationUtils';

// 운영 환경 보호: NODE_ENV가 production이면 명시적 강제 옵션 없이는 실행 차단.
function assertSafeEnv(): void {
    if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
        logger.error('seed.blocked.production', {
            message: 'production 환경에서 seed 실행이 차단되었습니다. 강제하려면 SEED_FORCE=true.',
        });
        process.exit(1);
    }
}

async function runSeed(): Promise<void> {
    const seedPath = path.resolve(__dirname, '../../sql/seed.sql');
    const sql = await fs.readFile(seedPath, 'utf8');
    const statements = splitStatements(sql);

    const conn = await pool.getConnection();
    try {
        let applied = 0;
        for (const stmt of statements) {
            await conn.query(stmt);
            applied += 1;
        }
        logger.info('seed.applied', { file: 'seed.sql', statements: applied });
    } finally {
        conn.release();
    }
}

(async () => {
    assertSafeEnv();
    try {
        await runSeed();
        await pool.end();
        process.exit(0);
    } catch (err) {
        logger.error('seed.failed', { error: err instanceof Error ? err.message : String(err) });
        await pool.end().catch(() => undefined);
        process.exit(1);
    }
})();
