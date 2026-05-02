import { promises as fs } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// generator는 환경에 시크릿이 없어도 동작해야 한다.
// .env가 있으면 사용하되, 누락된 키는 안전한 placeholder로 보강한다.
dotenv.config();
process.env.NODE_ENV ??= 'development';
process.env.DB_HOST ??= 'localhost';
process.env.DB_USER ??= 'placeholder';
process.env.DB_PASSWORD ??= 'placeholder';
process.env.DB_NAME ??= 'placeholder';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'postman-generator-placeholder-secret-1234567890';
}

// 라우트 파일이 import 시점에 ROUTE_REGISTRY 를 채운다.
import '../routes';
import { ROUTE_REGISTRY } from '../openapi/registry';
import { buildPostmanCollection } from '../openapi/postman';
import { logger } from '../utils/logger';

const OUTPUT = path.resolve(__dirname, '../../docs/postman.json');

async function main(): Promise<void> {
    if (ROUTE_REGISTRY.length === 0) {
        throw new Error('ROUTE_REGISTRY 가 비어있습니다. 라우트 파일이 defineRoute()를 호출하는지 확인하세요.');
    }

    const collection = buildPostmanCollection();
    await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
    await fs.writeFile(OUTPUT, JSON.stringify(collection, null, 2) + '\n');
    logger.info('postman.generated', {
        routes: ROUTE_REGISTRY.length,
        folders: collection.item.length,
        path: OUTPUT,
    });
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error('postman.generate.failed', { err });
        process.exit(1);
    });
