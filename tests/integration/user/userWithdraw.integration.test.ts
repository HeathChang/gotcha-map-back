/**
 * 회원탈퇴(soft delete) — 회귀 방지.
 *  - user_status 를 -1 로 바꾸고(행 보존) 보유 refresh 토큰을 전부 무효화한다.
 *  - 대상이 없거나 이미 탈퇴(affectedRows=0)면 404 NotFound.
 */
jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import { withTransaction } from '../../../src/config/database';
import { withdrawUser } from '../../../src/services/user.service';
import { NotFoundError } from '../../../src/utils/errors';

const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

// withTransaction 의 conn 을 모킹해 콜백을 실행한다.
function runTx(connQuery: jest.Mock) {
    (mockWithTransaction as unknown as jest.Mock).mockImplementation(
        async (cb: (c: { query: jest.Mock }) => Promise<unknown>) => cb({ query: connQuery }),
    );
}

beforeEach(() => jest.clearAllMocks());

describe('withdrawUser — soft delete', () => {
    it('user_status=-1 로 바꾸고 refresh 토큰을 전부 무효화', async () => {
        const connQuery = jest
            .fn()
            .mockResolvedValueOnce({ affectedRows: 1 }) // UPDATE users
            .mockResolvedValueOnce({ affectedRows: 3 }); // UPDATE refresh_tokens
        runTx(connQuery);

        await withdrawUser('u1');

        // 1) users soft-delete (실제 DELETE 가 아님)
        expect(connQuery.mock.calls[0][0]).toMatch(/UPDATE users SET user_status = -1/);
        expect(connQuery.mock.calls[0][0]).not.toMatch(/DELETE/i);
        expect(connQuery.mock.calls[0][1]).toEqual(['u1']);
        // 2) refresh 토큰 무효화
        expect(connQuery.mock.calls[1][0]).toMatch(/refresh_tokens SET revoked_at/);
        expect(connQuery.mock.calls[1][1]).toEqual(['u1']);
    });

    it('대상 회원이 없거나 이미 탈퇴면(affectedRows=0) 404', async () => {
        const connQuery = jest.fn().mockResolvedValueOnce({ affectedRows: 0 });
        runTx(connQuery);

        await expect(withdrawUser('missing')).rejects.toBeInstanceOf(NotFoundError);
        // 토큰 무효화 쿼리까지 가지 않는다.
        expect(connQuery).toHaveBeenCalledTimes(1);
    });
});
