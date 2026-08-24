import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * SMTP 메일 발송 유틸 (provider 무관 — SendGrid/SES/Gmail 등 SMTP 지원 서비스면 됨).
 *
 * 설계 원칙:
 * - SMTP 미설정이면 no-op(발송 안 하고 false 반환) — 로컬/테스트 부팅·동작을 막지 않는다.
 *   운영에서는 반드시 SMTP_* 환경변수를 채워야 실제 발송된다.
 * - 발송 실패는 throw 하지 않는다 — 호출부(비번 재설정)는 계정 존재 여부를 숨기기 위해
 *   항상 동일 응답을 내야 하므로, 메일 실패가 요청을 500 으로 만들면 안 된다. 로깅만 한다.
 */

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (!env.SMTP_HOST) return null;
    if (cachedTransporter) return cachedTransporter;

    cachedTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        // 465=implicit TLS, 그 외(587 등)=STARTTLS
        secure: env.SMTP_PORT === 465,
        auth:
            env.SMTP_USER && env.SMTP_PASS
                ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
                : undefined,
    });
    return cachedTransporter;
}

interface SendMailInput {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

/**
 * 메일 1건 발송. 성공 시 true, 미설정/실패 시 false. 절대 throw 하지 않는다.
 */
export async function sendMail({ to, subject, text, html }: SendMailInput): Promise<boolean> {
    const transporter = getTransporter();
    if (!transporter) {
        logger.warn('mail.skipped_no_smtp', { subject });
        return false;
    }
    try {
        await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
        return true;
    } catch (err) {
        // 평문 토큰 등 민감정보는 담지 않는다. 실패 사실만 기록.
        logger.error('mail.send_failed', {
            subject,
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

/**
 * 비밀번호 재설정 코드 메일. `code`는 클라이언트가 "재설정 코드" 입력란에 넣는 값(현행 계약: 토큰 원문).
 * @param ttlMinutes 만료까지 남은 분(안내 문구용).
 */
export async function sendPasswordResetEmail(
    to: string,
    code: string,
    ttlMinutes: number,
): Promise<boolean> {
    const subject = '[가챠맵] 비밀번호 재설정 코드';
    const text = [
        '가챠맵 비밀번호 재설정 요청이 접수되었습니다.',
        '',
        '아래 코드를 앱의 "재설정 코드" 입력란에 붙여넣어 주세요.',
        '',
        code,
        '',
        `이 코드는 ${ttlMinutes}분 후 만료됩니다.`,
        '본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
    ].join('\n');
    const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#222">
          <p>가챠맵 비밀번호 재설정 요청이 접수되었습니다.</p>
          <p>아래 코드를 앱의 <b>"재설정 코드"</b> 입력란에 붙여넣어 주세요.</p>
          <p style="font-family:monospace;font-size:15px;background:#f4f4f5;padding:12px 16px;border-radius:8px;word-break:break-all">${code}</p>
          <p style="color:#666;font-size:13px">이 코드는 ${ttlMinutes}분 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
        </div>`;
    return sendMail({ to, subject, text, html });
}
