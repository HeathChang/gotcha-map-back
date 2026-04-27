import {
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
    DomainError,
} from '../../src/utils/errors';
import { AppError } from '../../src/utils/AppError';

describe('errors', () => {
    it('AuthenticationError는 401 + code 보유', () => {
        const err = new AuthenticationError('auth', 'BAD_TOKEN');
        expect(err).toBeInstanceOf(DomainError);
        expect(err.status).toBe(401);
        expect(err.code).toBe('BAD_TOKEN');
    });

    it('ConflictError는 409', () => {
        const err = new ConflictError('dup', 'EMAIL_ALREADY_EXISTS');
        expect(err.status).toBe(409);
        expect(err.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('NotFoundError는 404', () => {
        expect(new NotFoundError('x').status).toBe(404);
    });

    it('ValidationError는 400 + details 전달 가능', () => {
        const err = new ValidationError('bad', 'BAD_INPUT', [{ field: 'email' }]);
        expect(err.status).toBe(400);
        expect(err.details).toEqual([{ field: 'email' }]);
    });

    it('AppError는 DomainError로 분류된다 (하위호환)', () => {
        const err = new AppError('legacy', 418, 'LEGACY');
        expect(err).toBeInstanceOf(DomainError);
        expect(err.status).toBe(418);
        expect(err.code).toBe('LEGACY');
    });
});
