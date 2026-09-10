import { ConflictError } from './errors';

/**
 * MariaDB UNIQUE 제약 위반(ER_DUP_ENTRY, errno 1062)인지 판별한다.
 *
 * check-then-insert 패턴은 SELECT 와 INSERT 사이에 경쟁이 존재한다.
 * 사전 SELECT 로 409 를 의도했더라도, 동시 요청에서는 DB 제약이 먼저 걸려
 * 그대로 두면 500 으로 새어나간다. 이 헬퍼로 의도한 409 로 되돌린다.
 */
export function isDuplicateEntryError(err: unknown): boolean {
    const e = err as { code?: string; errno?: number } | null;
    return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
}

/** INSERT 를 실행하고 UNIQUE 위반이면 지정한 ConflictError 로 변환한다. */
export async function insertOrConflict<T>(
    run: () => Promise<T>,
    conflict: { message: string; code: string },
): Promise<T> {
    try {
        return await run();
    } catch (err) {
        if (isDuplicateEntryError(err)) {
            throw new ConflictError(conflict.message, conflict.code);
        }
        throw err;
    }
}
