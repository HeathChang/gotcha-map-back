import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
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

    // 메일 발송(SMTP) — 비밀번호 재설정 등. 미설정 시 발송은 no-op(부팅은 정상).
    // 운영에서는 반드시 설정해야 비밀번호 재설정 메일이 실제로 나간다.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** 발신 표기. 예: "가챠맵 <no-reply@example.com>" */
    MAIL_FROM: z.string().default('가챠맵 <no-reply@gachamap.app>'),
})
    // M1: 운영 배포 시 안전하지 않은 쿠키/CORS 기본값이 그대로 나가지 않도록 강제(부팅 실패).
    .superRefine((val, ctx) => {
        // 브라우저는 SameSite=None 쿠키에 Secure 를 요구한다(환경 무관).
        if (val.COOKIE_SAMESITE === 'none' && !val.COOKIE_SECURE) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['COOKIE_SECURE'],
                message: 'COOKIE_SAMESITE=none 이면 COOKIE_SECURE=true 여야 합니다(브라우저 요구).',
            });
        }
        if (val.NODE_ENV === 'production') {
            // refresh 쿠키가 Secure 없이 발급되면 평문 구간에서 탈취 위험.
            if (!val.COOKIE_SECURE) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['COOKIE_SECURE'],
                    message: 'production 에서는 COOKIE_SECURE=true 여야 합니다.',
                });
            }
            // CORS 가 로컬 기본값이면 어드민/프론트 호출이 막히거나 설정 누락 상태로 배포됨.
            const onlyLocal = val.CORS_ORIGIN.every((o) => /localhost|127\.0\.0\.1/.test(o));
            if (val.CORS_ORIGIN.length === 0 || onlyLocal) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['CORS_ORIGIN'],
                    message:
                        'production 에서는 CORS_ORIGIN 을 실제 프론트/어드민 도메인으로 설정해야 합니다.',
                });
            }
        }
    });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
