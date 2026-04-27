import winston from 'winston';
import { env } from '../config/env';
import { getContext } from './requestContext';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const SENSITIVE_KEYS = new Set([
    'password',
    'newpassword',
    'oldpassword',
    'token',
    'accesstoken',
    'refreshtoken',
    'authorization',
    'cookie',
    'jwt',
    'secret',
]);

function redact(value: unknown, depth = 0): unknown {
    if (depth > 4 || value == null) return value;
    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
    if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_KEYS.has(k.toLowerCase())) {
                (value as Record<string, unknown>)[k] = '[REDACTED]';
            } else {
                (value as Record<string, unknown>)[k] = redact(v, depth + 1);
            }
        }
        return value;
    }
    return value;
}

const contextFormat = winston.format((info) => {
    const ctx = getContext();
    if (ctx?.traceId && !info.traceId) info.traceId = ctx.traceId;
    if (ctx?.userId && !info.userId) info.userId = ctx.userId;
    info.service = env.SERVICE_NAME;
    return info;
});

const redactFormat = winston.format((info) => redact(info) as winston.Logform.TransformableInfo);

const devFormat = printf(({ level, message, timestamp: ts, stack, traceId, ...rest }) => {
    const trace = traceId ? ` [${traceId}]` : '';
    const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${ts}${trace} [${level}] ${stack ?? message}${meta}`;
});

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp(),
        contextFormat(),
        redactFormat(),
        env.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat),
    ),
    transports: [new winston.transports.Console()],
});
