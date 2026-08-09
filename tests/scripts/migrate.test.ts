import { isSeedMigration, parseMigrationFile, splitStatements } from '../../src/scripts/migrationUtils';

describe('migrationUtils.splitStatements', () => {
    it('주석을 제거하고 세미콜론으로 분리한다', () => {
        const sql = `
            -- top level comment
            CREATE TABLE a (id INT);
            /* block
               comment */
            CREATE TABLE b (id INT);
        `;
        const stmts = splitStatements(sql);
        expect(stmts).toHaveLength(2);
        expect(stmts[0]).toMatch(/^CREATE TABLE a/);
        expect(stmts[1]).toMatch(/^CREATE TABLE b/);
    });

    it('빈 문장은 무시한다', () => {
        expect(splitStatements(';;;\n   ;')).toEqual([]);
    });

    it('마지막 세미콜론이 없어도 마지막 문장을 포함한다', () => {
        expect(splitStatements('SELECT 1')).toEqual(['SELECT 1']);
    });
});

describe('migrationUtils.parseMigrationFile', () => {
    it('표준 형식(NNNN_name.sql)을 파싱한다', () => {
        expect(parseMigrationFile('0001_init.sql')).toEqual({
            version: '0001',
            file: '0001_init.sql',
        });
        expect(parseMigrationFile('0042_add-column.sql')?.version).toBe('0042');
    });

    it('형식에 맞지 않으면 null', () => {
        expect(parseMigrationFile('init.sql')).toBeNull();
        expect(parseMigrationFile('0001_init.txt')).toBeNull();
        expect(parseMigrationFile('1_init.sql')).toBeNull();
    });
});

describe('migrationUtils.isSeedMigration (H2 — 운영 시드 스킵 판별)', () => {
    it('시드 마이그레이션(0006/0007/0009)만 true', () => {
        expect(isSeedMigration('0006_seed_stores.sql')).toBe(true);
        expect(isSeedMigration('0007_seed_test_store_gangnam.sql')).toBe(true);
        expect(isSeedMigration('0009_seed_banners.sql')).toBe(true);
    });

    it('스키마 마이그레이션은 전부 false (더미 아님)', () => {
        for (const f of [
            '0001_init.sql',
            '0002_password_reset_tokens.sql',
            '0003_refresh_tokens.sql',
            '0004_admin.sql',
            '0005_admin_refresh_tokens.sql',
            '0008_banners.sql',
            '0010_admin_role_rebrand.sql',
            '0011_store_product_overrides.sql',
        ]) {
            expect(isSeedMigration(f)).toBe(false);
        }
    });
});
