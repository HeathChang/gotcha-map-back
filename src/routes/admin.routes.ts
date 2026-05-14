import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as adminCtrl from '../controllers/admin.controller';
import * as adminInquiryCtrl from '../controllers/adminInquiry.controller';
import * as adminStoreCtrl from '../controllers/adminStore.controller';
import { defineRoute } from '../openapi/defineRoute';
import { env } from '../config/env';
import {
    adminAnswerInquirySchema,
    adminCreateStoreSchema,
    adminInquiryListQuerySchema,
    adminLoginSchema,
    adminStoreListQuerySchema,
    adminUpdateStoreSchema,
} from '../validators/admin.schema';

export const adminRouter = Router();
const BASE = '/api/v1/admin';

const adminAuthLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        code: 'TOO_MANY_REQUESTS',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    },
});

// ----------------------------------------------------------------
// Admin Auth
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/login',
    tag: 'Admin',
    summary: '어드민 로그인 (Access + Refresh 토큰 발급, kind=admin)',
    pre: [adminAuthLimiter],
    body: adminLoginSchema,
    handler: adminCtrl.login,
});

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/logout',
    tag: 'Admin',
    summary: '어드민 로그아웃 (refresh family 무효화 + 쿠키 제거)',
    pre: [adminAuthLimiter],
    handler: adminCtrl.logout,
});

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/me',
    tag: 'Admin',
    summary: '현재 어드민 프로필 조회',
    adminAuth: true,
    handler: adminCtrl.me,
});

// ----------------------------------------------------------------
// Admin Inquiries
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/inquiries',
    tag: 'Admin',
    summary: '문의 목록 조회 (페이지네이션, 상태/검색 필터)',
    adminAuth: true,
    adminRoles: ['super_admin', 'support_staff'],
    query: adminInquiryListQuerySchema,
    handler: adminInquiryCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/inquiries/stats',
    tag: 'Admin',
    summary: '문의 SLA 통계 (상태별 건수 / 평균·중앙값 응답시간 / 24h 초과 미답변)',
    adminAuth: true,
    adminRoles: ['super_admin', 'support_staff'],
    handler: adminInquiryCtrl.stats,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/inquiries/:inquiryId',
    tag: 'Admin',
    summary: '문의 답변 저장 + 상태 변경 (감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'support_staff'],
    pathParams: [{ name: 'inquiryId', description: '문의 ID' }],
    body: adminAnswerInquirySchema,
    handler: adminInquiryCtrl.answer,
});

// ----------------------------------------------------------------
// Admin Stores (매장 관리)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/stores',
    tag: 'Admin',
    summary: '매장 목록 조회 (페이지네이션, 이름/주소 검색)',
    adminAuth: true,
    adminRoles: ['super_admin'],
    query: adminStoreListQuerySchema,
    handler: adminStoreCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/stores',
    tag: 'Admin',
    summary: '매장 생성',
    adminAuth: true,
    adminRoles: ['super_admin'],
    body: adminCreateStoreSchema,
    handler: adminStoreCtrl.create,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/stores/:storeId',
    tag: 'Admin',
    summary: '매장 수정 (부분 업데이트)',
    adminAuth: true,
    adminRoles: ['super_admin'],
    pathParams: [{ name: 'storeId', description: '매장 ID' }],
    body: adminUpdateStoreSchema,
    handler: adminStoreCtrl.update,
});

defineRoute(adminRouter, BASE, {
    method: 'delete',
    path: '/stores/:storeId',
    tag: 'Admin',
    summary: '매장 삭제',
    adminAuth: true,
    adminRoles: ['super_admin'],
    pathParams: [{ name: 'storeId', description: '매장 ID' }],
    handler: adminStoreCtrl.remove,
});
