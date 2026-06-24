/**
 * 회원 프로필 수정 — 이메일 UNIQUE 충돌 회귀 방지.
 *  - 다른 회원 이메일로 변경 시 DB ER_DUP_ENTRY → 500 이 아니라 409 ConflictError(EMAIL_ALREADY_EXISTS) 로 변환되어야 한다.
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import { query } from '../../../src/config/database';
import { updateUser } from '../../../src/services/user.service';
import { ConflictError, NotFoundError } from '../../../src/utils/errors';

const mockQuery = query as jest.MockedFunction<typeof query>;

beforeEach(() => mockQuery.mockReset());

describe('updateUser — 이메일 충돌 처리', () => {
    it('다른 회원 이메일로 변경 시 ER_DUP_ENTRY → 409 EMAIL_ALREADY_EXISTS', async () => {
        mockQuery.mockRejectedValue({ code: 'ER_DUP_ENTRY' } as never);

        await expect(updateUser('u1', { email: 'taken@example.com' })).rejects.toMatchObject({
            code: 'EMAIL_ALREADY_EXISTS',
        });
        await expect(updateUser('u1', { email: 'taken@example.com' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('대상 회원이 없으면(affectedRows=0) 404', async () => {
        mockQuery.mockResolvedValue({ affectedRows: 0 } as never);

        await expect(updateUser('missing', { nickname: '새닉' })).rejects.toBeInstanceOf(NotFoundError);
    });
});
