import { z, ZodTypeAny } from 'zod';

/**
 * Zod 스키마에서 Postman/문서용 샘플 값을 추론한다.
 * 모든 케이스를 정확히 맞추려는 게 아니라, 클라이언트가 import 직후
 * "현실적인 형태"의 요청을 보낼 수 있도록 하는 용도다.
 */
export function exampleFromZod(schema: ZodTypeAny, key?: string): unknown {
    const def = (schema as { _def: { typeName: string } })._def;
    const typeName = def.typeName;

    switch (typeName) {
        case 'ZodObject': {
            const shape = (schema as z.AnyZodObject).shape;
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(shape)) {
                out[k] = exampleFromZod(v as ZodTypeAny, k);
            }
            return out;
        }
        case 'ZodString': {
            const checks = (schema as z.ZodString)._def.checks ?? [];
            if (checks.some((c) => c.kind === 'email')) return 'user@example.com';
            if (checks.some((c) => c.kind === 'uuid')) return '00000000-0000-0000-0000-000000000000';
            if (checks.some((c) => c.kind === 'url')) return 'https://example.com';
            if (key?.toLowerCase().includes('password')) return 'P@ssw0rd!';
            if (key?.toLowerCase().includes('token')) return 'a'.repeat(64);
            if (key?.toLowerCase().includes('id')) return 'sample-id';
            if (key === 'nickname') return 'heath';
            if (key === 'title') return '문의 제목';
            if (key === 'content') return '본문 내용';
            return key ?? 'string';
        }
        case 'ZodNumber': {
            if (key === 'lat') return 37.5665;
            if (key === 'lon') return 126.978;
            if (key === 'radiusKm') return 5;
            if (key === 'page') return 1;
            if (key === 'limit') return 20;
            return 0;
        }
        case 'ZodBoolean':
            return true;
        case 'ZodEnum':
            return (schema as z.ZodEnum<[string, ...string[]]>)._def.values[0];
        case 'ZodArray':
            return [exampleFromZod((schema as z.ZodArray<ZodTypeAny>)._def.type, key)];
        case 'ZodOptional':
            return exampleFromZod((schema as z.ZodOptional<ZodTypeAny>)._def.innerType, key);
        case 'ZodNullable':
            return exampleFromZod((schema as z.ZodNullable<ZodTypeAny>)._def.innerType, key);
        case 'ZodDefault':
            return (schema as z.ZodDefault<ZodTypeAny>)._def.defaultValue();
        case 'ZodEffects':
            return exampleFromZod(
                (schema as z.ZodEffects<ZodTypeAny>)._def.schema,
                key,
            );
        case 'ZodUnion': {
            const opts = (schema as z.ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>)._def.options;
            return exampleFromZod(opts[0], key);
        }
        case 'ZodLiteral':
            return (schema as z.ZodLiteral<unknown>)._def.value;
        case 'ZodLazy':
            return exampleFromZod((schema as z.ZodLazy<ZodTypeAny>)._def.getter(), key);
        default:
            return null;
    }
}
