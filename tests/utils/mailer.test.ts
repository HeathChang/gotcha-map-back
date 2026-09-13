import { sendMail, sendPasswordResetEmail } from '../../src/utils/mailer';

// setupEnv 는 SMTP_* 를 설정하지 않는다 → mailer 는 no-op 이어야 한다.
// (운영에서 SMTP 를 채우면 실제 발송. 여기서는 "미설정 시 안전하게 no-op + throw 안 함" 계약을 고정한다.)
describe('mailer (SMTP 미설정)', () => {
    it('sendMail 은 SMTP 미설정이면 false 를 반환하고 throw 하지 않는다', async () => {
        await expect(
            sendMail({ to: 'user@example.com', subject: '제목', text: '본문' }),
        ).resolves.toBe(false);
    });

    it('sendPasswordResetEmail 은 SMTP 미설정이면 false 를 반환한다(요청 흐름을 깨지 않음)', async () => {
        await expect(
            sendPasswordResetEmail('user@example.com', 'a'.repeat(64), 15),
        ).resolves.toBe(false);
    });
});
