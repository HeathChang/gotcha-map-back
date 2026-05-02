import { z } from 'zod';
import { exampleFromZod } from '../../src/openapi/zodExample';

describe('exampleFromZod', () => {
    it('객체 + email/password 키 휴리스틱', () => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            nickname: z.string().min(1),
        });
        expect(exampleFromZod(schema)).toEqual({
            email: 'user@example.com',
            password: 'P@ssw0rd!',
            nickname: 'heath',
        });
    });

    it('enum은 첫 번째 값을 사용', () => {
        expect(exampleFromZod(z.enum(['A', 'B']))).toBe('A');
    });

    it('optional/default를 풀어서 추론', () => {
        const schema = z.object({
            page: z.coerce.number().default(1),
            sortBy: z.enum(['popular', 'price_asc']).optional(),
        });
        expect(exampleFromZod(schema)).toEqual({ page: 1, sortBy: 'popular' });
    });

    it('union은 첫 옵션 사용', () => {
        const schema = z.union([z.literal('x'), z.literal('y')]);
        expect(exampleFromZod(schema)).toBe('x');
    });

    it('array는 단일 요소 배열', () => {
        expect(exampleFromZod(z.array(z.string().email()))).toEqual(['user@example.com']);
    });
});
