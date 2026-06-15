/**
 * Admin 공지 CRUD + isActive 토글 — 부분 업데이트가 핵심 차이.
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

describe('GET /api/v1/admin/announcements', () => {
    it('isActive 필터로 좁힐 때 WHERE 절 인자에 1/0 이 들어간다', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([
                {
                    announce_id: 'a1',
                    title: '테스트',
                    content: '본문',
                    is_active: 1,
                    created_at: new Date('2026-01-01'),
                    updated_at: new Date('2026-01-01'),
                },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/announcements?isActive=true')
            .set('Authorization', `Bearer ${adminToken('staff')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0]).toMatchObject({ announceId: 'a1', isActive: true });
        // COUNT 호출의 인자 배열 — is_active 가 1 로 좁혀졌는지
        const countArgs = mockQuery.mock.calls[0][1] as unknown[];
        expect(countArgs).toContain(1);
    });
});

describe('PATCH /api/v1/admin/announcements/:announceId — isActive 토글', () => {
    it('isActive 만 변경 → 감사 로그 announcement.update + diff 기록', async () => {
        mockQuery
            .mockResolvedValueOnce([                                           // before getAnnouncement
                {
                    announce_id: 'a1',
                    title: '제목',
                    content: '본문',
                    is_active: 0,
                    created_at: new Date('2026-01-01'),
                    updated_at: new Date('2026-01-01'),
                },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)               // UPDATE
            .mockResolvedValueOnce([                                           // after getAnnouncement
                {
                    announce_id: 'a1',
                    title: '제목',
                    content: '본문',
                    is_active: 1,
                    created_at: new Date('2026-01-01'),
                    updated_at: new Date('2026-01-02'),
                },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);              // audit

        const res = await request(app)
            .patch('/api/v1/admin/announcements/a1')
            .set('Authorization', `Bearer ${adminToken('admin')}`)
            .send({ isActive: true });

        expect(res.status).toBe(200);
        expect(res.body.data.isActive).toBe(true);

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('announcement.update');
        const diff = JSON.parse(auditArgs[5] as string);
        expect(diff.before.isActive).toBe(false);
        expect(diff.after.isActive).toBe(true);
    });
});

describe('POST /api/v1/admin/announcements', () => {
    it('타이틀/내용 입력 시 생성 + 감사 로그', async () => {
        const newId = 'ann-new';
        mockQuery
            .mockResolvedValueOnce([{ id: newId }] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never)
            .mockResolvedValueOnce([
                {
                    announce_id: newId,
                    title: '새 공지',
                    content: '내용',
                    is_active: 1,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            ] as never)
            .mockResolvedValueOnce({ affectedRows: 1 } as never);

        const res = await request(app)
            .post('/api/v1/admin/announcements')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ title: '새 공지', content: '내용' });

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe('새 공지');

        const auditArgs = mockQuery.mock.calls[3][1] as unknown[];
        expect(auditArgs[2]).toBe('announcement.create');
    });

    it('내용 누락 시 400', async () => {
        const res = await request(app)
            .post('/api/v1/admin/announcements')
            .set('Authorization', `Bearer ${adminToken('staff')}`)
            .send({ title: 'X' });
        expect(res.status).toBe(400);
    });
});
