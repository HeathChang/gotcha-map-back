/**
 * 어드민 시드 스크립트.
 *
 * 사용:
 *   npm run db:seed:admin -- --email=ops@gachamap.io --password=admin1234 --name=운영자 --role=super_admin
 *
 * 같은 email 이 이미 있으면 비밀번호/역할/이름을 갱신한다 (로컬 개발 편의).
 */
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../config/database';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';
import type { AdminRole } from '../types';

interface CliArgs {
    email: string;
    password: string;
    name: string;
    role: AdminRole;
}

const ALLOWED_ROLES: AdminRole[] = ['super_admin', 'content_manager', 'support_staff'];

function parseArgs(argv: string[]): CliArgs {
    const map = new Map<string, string>();
    for (const raw of argv.slice(2)) {
        const m = /^--([^=]+)=(.*)$/.exec(raw);
        if (m) map.set(m[1], m[2]);
    }
    const email = map.get('email');
    const password = map.get('password');
    const name = map.get('name') ?? '운영자';
    const roleRaw = (map.get('role') ?? 'super_admin') as AdminRole;

    if (!email || !password) {
        throw new Error(
            '필수 인자 누락: --email=<email> --password=<password> [--name=<name>] [--role=<role>]',
        );
    }
    if (!ALLOWED_ROLES.includes(roleRaw)) {
        throw new Error(`role 은 ${ALLOWED_ROLES.join(' | ')} 중 하나여야 합니다.`);
    }
    return { email, password, name, role: roleRaw };
}

async function upsertAdmin(args: CliArgs): Promise<void> {
    const hashed = await hashPassword(args.password);

    const existing = await query<Array<{ admin_id: string }>>(
        'SELECT admin_id FROM admin_users WHERE email = ?',
        [args.email],
    );

    if (existing.length > 0) {
        const adminId = existing[0].admin_id;
        await query(
            `UPDATE admin_users
             SET password = ?, name = ?, role = ?, admin_status = 1
             WHERE admin_id = ?`,
            [hashed, args.name, args.role, adminId],
        );
        logger.info('admin.seed.updated', {
            adminId,
            email: args.email,
            role: args.role,
        });
        return;
    }

    const adminId = uuidv4();
    await query(
        `INSERT INTO admin_users (admin_id, email, password, name, role, admin_status)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [adminId, args.email, hashed, args.name, args.role],
    );
    logger.info('admin.seed.created', {
        adminId,
        email: args.email,
        role: args.role,
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    await upsertAdmin(args);
    await pool.end();
}

if (require.main === module) {
    main().catch(async (err) => {
        logger.error('admin.seed.fatal', { err });
        try {
            await pool.end();
        } catch {
            /* ignore */
        }
        process.exit(1);
    });
}
