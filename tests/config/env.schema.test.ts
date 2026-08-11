/**
 * M1 회귀 — env 스키마의 운영 안전값 가드(superRefine).
 *  - production 에서 COOKIE_SECURE=false 또는 CORS 가 localhost 면 검증 실패(부팅 차단).
 *  - 올바른 운영값이면 통과. development/test 는 영향 없음.
 *  - SameSite=none 이면 환경 무관 COOKIE_SECURE=true 요구.
 * (envSchema 를 직접 safeParse 로 검증 — 모듈 로드는 test env 라 process.exit 안 탐.)
 */
import { envSchema } from '../../src/config/env';

const base = {
    DB_HOST: 'localhost',
    DB_USER: 'root',
    DB_PASSWORD: 'pw',
    DB_NAME: 'db',
    JWT_SECRET: 'x'.repeat(32),
};

function issuePaths(input: Record<string, unknown>): string[] {
    const r = envSchema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

describe('envSchema — M1 운영 안전값 가드', () => {
    it('production + 안전하지 않은 기본값(COOKIE_SECURE 미설정 + CORS localhost) → 실패', () => {
        const paths = issuePaths({ ...base, NODE_ENV: 'production' });
        expect(paths).toContain('COOKIE_SECURE');
        expect(paths).toContain('CORS_ORIGIN');
    });

    it('production + 올바른 운영값 → 통과', () => {
        const r = envSchema.safeParse({
            ...base,
            NODE_ENV: 'production',
            COOKIE_SECURE: 'true',
            COOKIE_SAMESITE: 'none',
            CORS_ORIGIN: 'https://admin.gachamap.co.kr,https://gachamap.co.kr',
        });
        expect(r.success).toBe(true);
    });

    it('development 는 안전하지 않은 기본값이어도 통과(가드는 production 전용)', () => {
        const r = envSchema.safeParse({ ...base, NODE_ENV: 'development' });
        expect(r.success).toBe(true);
    });

    it('SameSite=none + COOKIE_SECURE=false 는 환경 무관 실패', () => {
        const paths = issuePaths({
            ...base,
            NODE_ENV: 'development',
            COOKIE_SAMESITE: 'none',
            COOKIE_SECURE: 'false',
        });
        expect(paths).toContain('COOKIE_SECURE');
    });
});
