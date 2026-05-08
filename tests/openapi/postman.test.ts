import { z } from 'zod';
import { buildPostmanCollection } from '../../src/openapi/postman';
import { RouteDefinition } from '../../src/openapi/registry';

const routes: RouteDefinition[] = [
    {
        method: 'post',
        path: '/login',
        basePath: '/api/v1',
        tag: 'Auth',
        summary: '로그인',
        auth: false,
        body: z.object({ email: z.string().email(), password: z.string().min(8) }),
    },
    {
        method: 'get',
        path: '/users',
        basePath: '/api/v1',
        tag: 'User',
        summary: '사용자 조회',
        auth: false,
        query: z.object({ userId: z.string().min(1) }),
    },
    {
        method: 'patch',
        path: '/users/info',
        basePath: '/api/v1',
        tag: 'User',
        summary: '본인 수정',
        auth: true,
        body: z.object({ nickname: z.string().min(1).optional() }),
    },
];

describe('buildPostmanCollection', () => {
    const collection = buildPostmanCollection(routes, { baseUrl: 'http://localhost:8060' });

    it('태그별로 폴더가 생긴다', () => {
        const folderNames = collection.item.map((f) => f.name);
        expect(folderNames).toEqual(expect.arrayContaining(['Auth', 'User']));
    });

    it('schema는 v2.1.0', () => {
        expect(collection.info.schema).toMatch(/v2\.1\.0/);
    });

    it('인증 필요 엔드포인트는 Bearer auth가 활성화된다', () => {
        const folder = collection.item.find((f) => f.name === 'User')!;
        const patch = folder.item.find((it) => it.request.method === 'PATCH')!;
        expect(patch.request.auth?.bearer[0].value).toBe('{{accessToken}}');
    });

    it('JSON body는 Content-Type 헤더가 자동 추가된다', () => {
        const folder = collection.item.find((f) => f.name === 'Auth')!;
        const login = folder.item.find((it) => it.request.method === 'POST')!;
        expect(login.request.header).toEqual([
            { key: 'Content-Type', value: 'application/json' },
        ]);
        expect(login.request.body?.mode).toBe('raw');
        const parsed = JSON.parse(login.request.body!.raw);
        expect(parsed.email).toBe('user@example.com');
    });

    it('query 스키마는 URL query로 매핑된다', () => {
        const folder = collection.item.find((f) => f.name === 'User')!;
        const get = folder.item.find((it) => it.request.method === 'GET')!;
        expect(get.request.url.query).toEqual([{ key: 'userId', value: 'sample-id' }]);
    });

    it('baseUrl 변수가 컬렉션 변수로 포함된다', () => {
        expect(collection.variable).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: 'baseUrl', value: 'http://localhost:8060' }),
                expect.objectContaining({ key: 'accessToken' }),
            ]),
        );
    });
});
