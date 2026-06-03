/**
 * Admin 문의 — 목록 + SLA 통계 + 답변(트랜잭션 + 감사 로그).
 */
import request from 'supertest';

jest.mock('../../../src/config/database', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));

import app from '../../../src/app';
import { query, withTransaction } from '../../../src/config/database';
import { adminToken } from '../../helpers/adminToken';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

describe('GET /api/v1/admin/inquiries', () => {
    it('content_manager 는 접근 불가 (super_admin/support_staff 만)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/inquiries')
            .set('Authorization', `Bearer ${adminToken('content_manager')}`);
        expect(res.status).toBe(403);
    });

    it('목록 응답에 userEmail JOIN 노출', async () => {
        mockQuery
            .mockResolvedValueOnce([{ total: 1 }] as never)
            .mockResolvedValueOnce([
                {
                    inquiry_id: 'q1',
                    user_id: 'u1',
                    user_email: 'alice@x.com',
                    title: '문의제목',
                    content: '본문',
                    status: 'pending',
                    answer: null,
                    answered_at: null,
                    answered_by_admin_id: null,
                    created_at: new Date('2026-05-01'),
                },
            ] as never);

        const res = await request(app)
            .get('/api/v1/admin/inquiries')
            .set('Authorization', `Bearer ${adminToken('support_staff')}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items[0]).toMatchObject({
            inquiryId: 'q1',
            userEmail: 'alice@x.com',
            status: 'pending',
        });
    });
});

describe('GET /api/v1/admin/inquiries/stats — SLA 통계', () => {
    it('상태별 카운트 + 평균/중앙값/SLA 위반 응답', async () => {
        mockQuery
            .mockResolvedValueOnce([                                       // statusRows
                { status: 'pending', total: 3 },
                { status: 'completed', total: 7 },
            ] as never)
            .mockResolvedValueOnce([                                       // responseRows
                { hours: 1.5 },
                { hours: 3.0 },
                { hours: 5.0 },
            ] as never)
            .mockResolvedValueOnce([{ total: 1 }] as never);               // overdue

        const res = await request(app)
            .get('/api/v1/admin/inquiries/stats')
            .set('Authorization', `Bearer ${adminToken('super_admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            countByStatus: { pending: 3, processing: 0, completed: 7, rejected: 0 },
            avgResponseHours: expect.any(Number),
            medianResponseHours: 3.0,
            overdueCount: 1,
            answeredSampleSize: 3,
        });
    });
});

describe('PATCH /api/v1/admin/inquiries/:inquiryId — 답변', () => {
    it('답변 저장 → 감사 로그 inquiry.answer 기록', async () => {
        // before fetch
        mockQuery.mockResolvedValueOnce([
            {
                inquiry_id: 'q1',
                user_id: 'u1',
                user_email: 'alice@x.com',
                title: 'T',
                content: 'C',
                status: 'pending',
                answer: null,
                answered_at: null,
                answered_by_admin_id: null,
                created_at: new Date('2026-05-01'),
            },
        ] as never);

        // withTransaction: UPDATE + SELECT inside (mock 시그니처 캐스팅으로 우회)
        (mockWithTransaction as unknown as jest.Mock).mockImplementation(
            async (cb: (c: { query: jest.Mock }) => Promise<unknown>) => {
                const conn = {
                    query: jest.fn()
                        .mockResolvedValueOnce({ affectedRows: 1 })            // UPDATE
                        .mockResolvedValueOnce([                               // SELECT after
                            {
                                inquiry_id: 'q1',
                                user_id: 'u1',
                                user_email: 'alice@x.com',
                                title: 'T',
                                content: 'C',
                                status: 'completed',
                                answer: '확인했습니다',
                                answered_at: new Date(),
                                answered_by_admin_id: 'admin-test',
                                created_at: new Date('2026-05-01'),
                            },
                        ]),
                };
                return cb(conn);
            },
        );

        // audit log INSERT
        mockQuery.mockResolvedValueOnce({ affectedRows: 1 } as never);

        const res = await request(app)
            .patch('/api/v1/admin/inquiries/q1')
            .set('Authorization', `Bearer ${adminToken('support_staff')}`)
            .send({ status: 'completed', answer: '확인했습니다' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('completed');
        expect(res.body.data.answer).toBe('확인했습니다');

        // 감사 로그는 mockQuery 마지막 호출
        const calls = mockQuery.mock.calls;
        const auditCall = calls[calls.length - 1];
        expect(auditCall[0]).toContain('INSERT INTO admin_audit_logs');
        const auditArgs = auditCall[1] as unknown[];
        expect(auditArgs[2]).toBe('inquiry.answer');
    });
});
