import { getContext, runWithContext, setUserId } from '../../src/utils/requestContext';

describe('requestContext', () => {
    it('컨텍스트 외부에서는 undefined', () => {
        expect(getContext()).toBeUndefined();
    });

    it('runWithContext 내부에서 traceId를 조회할 수 있다', () => {
        runWithContext({ traceId: 't1' }, () => {
            expect(getContext()?.traceId).toBe('t1');
        });
    });

    it('setUserId로 사용자 식별자 주입이 가능하다', () => {
        runWithContext({ traceId: 't2' }, () => {
            setUserId('u-42');
            expect(getContext()?.userId).toBe('u-42');
        });
    });

    it('서로 다른 컨텍스트는 격리된다', async () => {
        const results: Array<string | undefined> = [];
        await Promise.all([
            new Promise<void>((resolve) => {
                runWithContext({ traceId: 'A' }, () => {
                    setImmediate(() => {
                        results.push(getContext()?.traceId);
                        resolve();
                    });
                });
            }),
            new Promise<void>((resolve) => {
                runWithContext({ traceId: 'B' }, () => {
                    setImmediate(() => {
                        results.push(getContext()?.traceId);
                        resolve();
                    });
                });
            }),
        ]);
        expect(results.sort()).toEqual(['A', 'B']);
    });
});
