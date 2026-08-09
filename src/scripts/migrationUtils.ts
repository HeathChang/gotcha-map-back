export const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_-]+\.sql$/i;

export function splitStatements(sql: string): string[] {
    // 주석 제거 후 세미콜론 분리. DELIMITER 같은 고급 구문은 미지원 (필요 시 확장).
    const stripped = sql
        .replace(/--[^\n]*\n/g, '\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    return stripped
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function parseMigrationFile(name: string): { version: string; file: string } | null {
    const match = MIGRATION_FILE_PATTERN.exec(name);
    if (!match) return null;
    return { version: match[1], file: name };
}

/**
 * 시드성(개발용 더미 데이터) 마이그레이션 여부 — 파일명에 `_seed_` 포함.
 * 예: 0006_seed_stores, 0007_seed_test_store_gangnam, 0009_seed_banners.
 * 스키마 마이그레이션(0001_init 등)은 해당하지 않는다. 운영에서 스킵 대상(H2).
 */
export function isSeedMigration(file: string): boolean {
    return /_seed_/i.test(file);
}
