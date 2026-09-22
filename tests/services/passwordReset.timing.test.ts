/**
 * 비밀번호 재설정 요청은 메일 발송(SMTP 왕복)을 기다리지 않고 응답해야 한다.
 * 기다리면 "계정 있음"만 수백 ms 늦어져 응답 시간으로 계정 존재가 새어나간다.
 */
jest.mock('../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));
jest.mock('../../src/utils/mailer', () => ({
    sendPasswordResetEmail: jest.fn(),
}));

import { query, withTransaction } from '../../src/config/database';
import { sendPasswordResetEmail } from '../../src/utils/mailer';
import { requestPasswordReset } from '../../src/services/user.service';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockSend = sendPasswordResetEmail as jest.MockedFunction<typeof sendPasswordResetEmail>;

describe('requestPasswordReset — 타이밍 채널', () => {
    it('메일 발송 Promise 가 pending 이어도 요청 처리는 즉시 완료된다', async () => {
        mockQuery.mockResolvedValueOnce([{ user_id: 'u1' }] as never);
        (withTransaction as unknown as jest.Mock).mockImplementation(
            async (cb: (c: { query: jest.Mock }) => Promise<unknown>) =>
                cb({ query: jest.fn().mockResolvedValue(undefined) }),
        );
        let resolveMail: (v: boolean) => void = () => undefined;
        mockSend.mockReturnValue(new Promise<boolean>((r) => { resolveMail = r; }));

        let settled = false;
        const p = requestPasswordReset('alice@x.com').then(() => { settled = true; });
        await new Promise((r) => setImmediate(r));

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(settled).toBe(true); // 메일이 아직 안 끝났는데도 완료
        resolveMail(true);
        await p;
    });
});
