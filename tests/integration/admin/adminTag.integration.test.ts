/**
 * Admin 태그 CRUD 통합 — route → controller → service → DB(mock) 끝까지.
 * tag 는 가장 단순한 admin CRUD 라 패턴 검증의 기준이 된다.
 *
 * 다른 도메인 (announcement / store / product) 도 동일한 mockQuery 시퀀스 패턴을 따른다:
 *   1) SELECT UUID()  → 새 ID
 *   2) INSERT 도메인 테이블
 *   3) SELECT 도메인 → 생성된 row
 *   4) INSERT admin_audit_logs
 */
import request from 'supertest';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../../src/app';
import { query } from '../../../src/config/database';
import { adminToken } from '../../helpers/adminToken';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('GET /api/v1/admin/tags', () => {
    it('인증 없으면 401', async () => {
        const res = await request(app).get('/api/v1/admin/tags');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('MISSING_BEARER_TOKEN');
    });

    it('support_staff 토큰은 403 — 태그 라우트는 super_admin/content_manager 만 허용', async () => {
        const res = await request(app)
            .get('/api/v1/admin/tags')
            .set('Authorization', `Bearer ${adminToken('support_staff')}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_ROLE_FORBIDDEN');
    });

    it('content_manager 토큰으로 목록 조회 — pagination 응답 형태 검증', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 2 }] as never) // COUNT
            .mockResolvedValueOnce([
                { tag_id: 't1', name: '산리오', relation_type: 'character', created_at: new Date('2026-01-01') },
                { tag_id: 't2', name: '치이카와', relation_type: 'character', created_at: new Date('2026-01-02') },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/tags')
            .set('Authorization', `Bearer ${adminToken('content_manager')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(2);
        expect(res.body.data.items[0]).toMatchObject({
            tagId: 't1',
            name: '산리오',
            relationType: 'character',
        });
        expect(res.body.data.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
        });
    });
});

describe('POST /api/v1/admin/tags', () => {
    it('태그 생성 → 감사 로그까지 INSERT 호출', async () => {
        const newId = 'tag-new';
        mockQuery
            .mockResolvedValueOnce([{ id: newId }] as never)               // SELECT UUID()
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // INSERT tags
            .mockResolvedValueOnce([                                       // getTag (SELECT)
                { tag_id: newId, name: '신상', relation_type: null, created_at: new Date('2026-05-01') },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // INSERT admin_audit_logs

        const res = await request(app)
            .post('/api/v1/admin/tags')
            .set('Authorization', `Bearer ${adminToken('content_manager')}`)
            .send({ name: '신상' });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ tagId: newId, name: '신상', relationType: null });

        // 마지막 query 호출이 audit_log INSERT 여야 한다 (vision §3 mutation 100% 기록).
        expect(mockQuery).toHaveBeenCalledTimes(4);
        const auditSql = mockQuery.mock.calls[3][0] as string;
        expect(auditSql).toContain('INSERT INTO admin_audit_logs');
        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('tag.create');
        expect(auditArgs[3]).toBe('tag');
    });

    it('이름 누락 시 400 (zod 검증)', async () => {
        const res = await request(app)
            .post('/api/v1/admin/tags')
            .set('Authorization', `Bearer ${adminToken('content_manager')}`)
            .send({});
        expect(res.status).toBe(400);
    });
});

describe('PATCH /api/v1/admin/tags/:tagId', () => {
    it('이름 변경 → 감사 로그 action=tag.update 기록', async () => {
        mockQuery
            .mockResolvedValueOnce([                                       // before getTag
                { tag_id: 't1', name: 'OLD', relation_type: null, created_at: new Date('2026-01-01') },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // UPDATE tags
            .mockResolvedValueOnce([                                       // after getTag
                { tag_id: 't1', name: 'NEW', relation_type: null, created_at: new Date('2026-01-01') },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit_log

        const res = await request(app)
            .patch('/api/v1/admin/tags/t1')
            .set('Authorization', `Bearer ${adminToken('super_admin')}`)
            .send({ name: 'NEW' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('NEW');

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('tag.update');
        // diff 가 JSON 문자열로 저장 — before/after 모두 포함
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.name).toBe('OLD');
        expect(diff.after.name).toBe('NEW');
    });
});

describe('DELETE /api/v1/admin/tags/:tagId', () => {
    it('삭제 → 감사 로그 action=tag.delete + before 스냅샷 보존', async () => {
        mockQuery
            .mockResolvedValueOnce([                                       // before getTag
                { tag_id: 't1', name: '삭제대상', relation_type: 'character', created_at: new Date('2026-01-01') },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)           // DELETE
            .mockResolvedValueOnce({ affectedRows: 1 } as never);          // audit_log

        const res = await request(app)
            .delete('/api/v1/admin/tags/t1')
            .set('Authorization', `Bearer ${adminToken('super_admin')}`);

        expect(res.status).toBe(200);

        const auditArgs = mockQuery.mock.calls[2][1] as unknown[];
        expect(auditArgs[2]).toBe('tag.delete');
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.name).toBe('삭제대상');
    });

    it('존재하지 않는 tagId 는 404 — DELETE 결과 affectedRows=0 케이스', async () => {
        // before getTag 가 NotFound 를 던지는 시나리오: 0 rows 반환
        mockQuery.mockResolvedValueOnce([] as never);

        const res = await request(app)
            .delete('/api/v1/admin/tags/missing')
            .set('Authorization', `Bearer ${adminToken('super_admin')}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('TAG_NOT_FOUND');
    });
});
