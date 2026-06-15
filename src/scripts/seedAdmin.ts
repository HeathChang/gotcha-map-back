/**
 * 어드민 시드 스크립트. 최초 admin 부트스트랩 용도(이후 운영자 계정은 /admins 화면에서 생성).
 *
 * 사용:
 *   npm run db:seed:admin -- --email=ops@gachamap.io --password=admin1234 --name=운영자 --role=admin
 *   npm run db:seed:admin -- --email=점주@store.com --password=pw1234 --role=member --store-id=<storeId>
 *
 * 같은 email 이 이미 있으면 비밀번호/역할/이름/매장을 갱신한다 (로컬 개발 편의).
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
    storeId: string | null;
}

const ALLOWED_ROLES: AdminRole[] = ['admin', 'staff', 'member'];

function parseArgs(argv: string[]): CliArgs {
    const map = new Map<string, string>();
    for (const raw of argv.slice(2)) {
        const m = /^--([^=]+)=(.*)$/.exec(raw);
        if (m) map.set(m[1], m[2]);
    }
    const email = map.get('email');
    const password = map.get('password');
    const name = map.get('name') ?? '운영자';
    const roleRaw = (map.get('role') ?? 'admin') as AdminRole;
    const storeId = map.get('store-id') ?? null;

    if (!email || !password) {
        throw new Error(
            '필수 인자 누락: --email=<email> --password=<password> [--name=<name>] [--role=<role>] [--store-id=<id>]',
        );
    }
    if (!ALLOWED_ROLES.includes(roleRaw)) {
        throw new Error(`role 은 ${ALLOWED_ROLES.join(' | ')} 중 하나여야 합니다.`);
    }
    if (roleRaw === 'member' && !storeId) {
        throw new Error('role=member 는 --store-id=<storeId> 가 필수입니다 (담당 매장 배정).');
    }
    // admin/staff 는 매장 배정이 없다.
    return { email, password, name, role: roleRaw, storeId: roleRaw === 'member' ? storeId : null };
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
             SET password = ?, name = ?, role = ?, store_id = ?, admin_status = 1
             WHERE admin_id = ?`,
            [hashed, args.name, args.role, args.storeId, adminId],
        );
        logger.info('admin.seed.updated', {
            adminId,
            email: args.email,
            role: args.role,
            storeId: args.storeId,
        });
        return;
    }

    const adminId = uuidv4();
    await query(
        `INSERT INTO admin_users (admin_id, email, password, name, role, store_id, admin_status)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [adminId, args.email, hashed, args.name, args.role, args.storeId],
    );
    logger.info('admin.seed.created', {
        adminId,
        email: args.email,
        role: args.role,
        storeId: args.storeId,
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
