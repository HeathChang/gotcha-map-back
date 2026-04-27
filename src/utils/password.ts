import bcrypt from 'bcrypt';
import { env } from '../config/env';

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
}
