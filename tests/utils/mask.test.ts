import { maskEmail, maskPhone } from '../../src/utils/mask';

describe('mask', () => {
    describe('maskEmail', () => {
        it('masks local part and keeps domain', () => {
            expect(maskEmail('heath@example.com')).toBe('he***@example.com');
        });

        it('masks short local (<=2) keeping single char', () => {
            expect(maskEmail('ab@ex.com')).toBe('a***@ex.com');
        });

        it('returns *** for malformed email without @', () => {
            expect(maskEmail('nope')).toBe('***');
        });

        it('returns null for nullish', () => {
            expect(maskEmail(null)).toBeNull();
            expect(maskEmail(undefined)).toBeNull();
        });
    });

    describe('maskPhone', () => {
        it('masks middle digits', () => {
            expect(maskPhone('010-1234-5678')).toBe('010****78');
        });

        it('returns *** for too-short phone', () => {
            expect(maskPhone('12')).toBe('***');
        });

        it('returns null for nullish', () => {
            expect(maskPhone(null)).toBeNull();
        });
    });
});
