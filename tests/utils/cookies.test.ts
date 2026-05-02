import { Request } from 'express';
import { readCookie } from '../../src/utils/cookies';

function buildReq(headerValue?: string): Request {
    return { headers: { cookie: headerValue } } as unknown as Request;
}

describe('readCookie', () => {
    it('단일 쿠키를 읽는다', () => {
        expect(readCookie(buildReq('gm_refresh=abcd'), 'gm_refresh')).toBe('abcd');
    });

    it('여러 쿠키 중 하나를 정확히 골라낸다', () => {
        expect(
            readCookie(buildReq('a=1; gm_refresh=xyz; b=2'), 'gm_refresh'),
        ).toBe('xyz');
    });

    it('= 를 포함한 값도 정상 디코드', () => {
        expect(
            readCookie(buildReq('gm_refresh=YWJjZA%3D%3D'), 'gm_refresh'),
        ).toBe('YWJjZA==');
    });

    it('헤더가 없으면 undefined', () => {
        expect(readCookie(buildReq(), 'gm_refresh')).toBeUndefined();
    });

    it('일치하지 않으면 undefined', () => {
        expect(readCookie(buildReq('other=1'), 'gm_refresh')).toBeUndefined();
    });
});
