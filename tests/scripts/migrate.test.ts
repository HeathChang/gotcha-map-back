import { parseMigrationFile, splitStatements } from '../../src/scripts/migrationUtils';

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
