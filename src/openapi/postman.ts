import { ROUTE_REGISTRY, RouteDefinition } from './registry';
import { exampleFromZod } from './zodExample';

interface PostmanUrl {
    raw: string;
    host: string[];
    path: string[];
    query?: Array<{ key: string; value: string; description?: string }>;
    variable?: Array<{ key: string; value: string; description?: string }>;
}

interface PostmanRequest {
    method: string;
    header: Array<{ key: string; value: string; description?: string }>;
    body?: { mode: 'raw'; raw: string; options: { raw: { language: 'json' } } };
    url: PostmanUrl;
    description?: string;
    auth?: { type: 'bearer'; bearer: Array<{ key: string; value: string; type: 'string' }> };
}

interface PostmanItem {
    name: string;
    request: PostmanRequest;
    response: unknown[];
}

interface PostmanFolder {
    name: string;
    item: PostmanItem[];
}

export interface PostmanCollection {
    info: {
        name: string;
        description: string;
        schema: string;
        _postman_id?: string;
    };
    item: PostmanFolder[];
    auth: { type: 'bearer'; bearer: Array<{ key: string; value: string; type: 'string' }> };
    variable: Array<{ key: string; value: string }>;
}

const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function joinPath(basePath: string, path: string): string {
    const left = basePath.replace(/\/$/, '');
    const right = path.startsWith('/') ? path : `/${path}`;
    const joined = `${left}${right}`;
    return joined === '' ? '/' : joined.replace(/\/{2,}/g, '/');
}

function buildUrl(def: RouteDefinition): PostmanUrl {
    const fullPath = joinPath(def.basePath, def.path);
    const segments = fullPath.split('/').filter(Boolean);
    const url: PostmanUrl = {
        raw: `{{baseUrl}}${fullPath}`,
        host: ['{{baseUrl}}'],
        path: segments,
    };

    if (def.query) {
        const example = exampleFromZod(def.query) as Record<string, unknown> | null;
        if (example && typeof example === 'object') {
            url.query = Object.entries(example).map(([key, value]) => ({
                key,
                value: value == null ? '' : String(value),
            }));
        }
    }

    if (def.pathParams && def.pathParams.length > 0) {
        url.variable = def.pathParams.map((p) => ({
            key: p.name,
            value: p.example ?? '',
            description: p.description,
        }));
    }

    return url;
}

function buildRequest(def: RouteDefinition): PostmanRequest {
    const headers: PostmanRequest['header'] = [];

    if (def.body) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
    }

    const request: PostmanRequest = {
        method: def.method.toUpperCase(),
        header: headers,
        url: buildUrl(def),
    };

    if (def.description || def.summary) {
        request.description = def.description ?? def.summary;
    }

    if (def.body) {
        const example = exampleFromZod(def.body);
        request.body = {
            mode: 'raw',
            raw: JSON.stringify(example, null, 2),
            options: { raw: { language: 'json' } },
        };
    }

    if (def.auth) {
        request.auth = {
            type: 'bearer',
            bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
        };
    } else {
        // 컬렉션 기본 auth(베어러)를 끔
        request.auth = {
            type: 'bearer',
            bearer: [{ key: 'token', value: '', type: 'string' }],
        };
    }

    return request;
}

function methodOrder(m: string): number {
    return ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].indexOf(m.toUpperCase());
}

export function buildPostmanCollection(
    routes: RouteDefinition[] = ROUTE_REGISTRY,
    options: { name?: string; baseUrl?: string } = {},
): PostmanCollection {
    const folders = new Map<string, PostmanFolder>();

    for (const def of [...routes].sort((a, b) => {
        const t = a.tag.localeCompare(b.tag);
        if (t !== 0) return t;
        const p = joinPath(a.basePath, a.path).localeCompare(joinPath(b.basePath, b.path));
        if (p !== 0) return p;
        return methodOrder(a.method) - methodOrder(b.method);
    })) {
        const folder = folders.get(def.tag) ?? { name: def.tag, item: [] };
        folder.item.push({
            name: `${def.method.toUpperCase()} ${joinPath(def.basePath, def.path)} — ${def.summary}`,
            request: buildRequest(def),
            response: [],
        });
        folders.set(def.tag, folder);
    }

    return {
        info: {
            name: options.name ?? 'GachaMap API',
            description:
                'GachaMap 백엔드 API 컬렉션. `npm run postman:generate` 로 라우트 레지스트리에서 자동 생성됩니다.',
            schema: COLLECTION_SCHEMA,
        },
        item: Array.from(folders.values()),
        auth: {
            type: 'bearer',
            bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
        },
        variable: [
            { key: 'baseUrl', value: options.baseUrl ?? 'http://localhost:8060' },
            { key: 'accessToken', value: '' },
        ],
    };
}
