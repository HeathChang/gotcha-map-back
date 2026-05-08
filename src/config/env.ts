import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(8060),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string(),
    DB_NAME: z.string().min(1),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    /** Access 토큰 TTL. auth.md: 5~15분 권장. */
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    /** Refresh 토큰 TTL(일 단위). auth.md: 짧은 access + rotation 적용. */
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    /** 하위 호환: 일부 기존 코드에서 사용. */
    JWT_EXPIRES_IN: z.string().default('15m'),

    /** 쿠키 보안 설정. */
    COOKIE_SECURE: z
        .string()
        .default('false')
        .transform((v) => v.toLowerCase() === 'true'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),

    CORS_ORIGIN: z
        .string()
        .default('http://localhost:3000')
        .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

    // auth.md: bcrypt cost >= 12 권장. 테스트 환경은 속도를 위해 낮출 수 있음.
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    SERVICE_NAME: z.string().default('gachamap-api'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
