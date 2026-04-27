export function maskEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const visible = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2);
    return `${visible}***@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}
