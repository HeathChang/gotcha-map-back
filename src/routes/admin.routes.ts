import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as adminCtrl from '../controllers/admin.controller';
import * as adminInquiryCtrl from '../controllers/adminInquiry.controller';
import * as adminStoreCtrl from '../controllers/adminStore.controller';
import * as adminTagCtrl from '../controllers/adminTag.controller';
import * as adminAnnouncementCtrl from '../controllers/adminAnnouncement.controller';
import * as adminAuditLogCtrl from '../controllers/adminAuditLog.controller';
import * as adminUserCtrl from '../controllers/adminUser.controller';
import * as adminProductCtrl from '../controllers/adminProduct.controller';
import { defineRoute } from '../openapi/defineRoute';
import { env } from '../config/env';
import {
    adminAnnouncementListQuerySchema,
    adminAnswerInquirySchema,
    adminAuditLogListQuerySchema,
    adminCreateAnnouncementSchema,
    adminCreateProductSchema,
    adminCreateStoreSchema,
    adminCreateTagSchema,
    adminInquiryListQuerySchema,
    adminLoginSchema,
    adminProductListQuerySchema,
    adminStoreListQuerySchema,
    adminTagListQuerySchema,
    adminUpdateAnnouncementSchema,
    adminUpdateProductSchema,
    adminUpdateStoreSchema,
    adminUpdateTagSchema,
    adminUpdateUserStatusSchema,
    adminUserListQuerySchema,
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

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/refresh',
    tag: 'Admin',
    summary: '어드민 refresh 토큰 회전 (httpOnly 쿠키 또는 body, 1회용 + family rotation)',
    description:
        'Refresh 토큰은 1회용. 정상 회전 시 새 access + refresh 발급. 재사용 감지 시 family 전체 무효화.',
    pre: [adminAuthLimiter],
    handler: adminCtrl.refresh,
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

// ----------------------------------------------------------------
// Admin Tags (태그 관리)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/tags',
    tag: 'Admin',
    summary: '태그 목록 조회 (페이지네이션, 이름 검색 / relationType 필터)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    query: adminTagListQuerySchema,
    handler: adminTagCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/tags',
    tag: 'Admin',
    summary: '태그 생성 (감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    body: adminCreateTagSchema,
    handler: adminTagCtrl.create,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/tags/:tagId',
    tag: 'Admin',
    summary: '태그 수정 (부분 업데이트, 감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'tagId', description: '태그 ID' }],
    body: adminUpdateTagSchema,
    handler: adminTagCtrl.update,
});

defineRoute(adminRouter, BASE, {
    method: 'delete',
    path: '/tags/:tagId',
    tag: 'Admin',
    summary: '태그 삭제 (감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'tagId', description: '태그 ID' }],
    handler: adminTagCtrl.remove,
});

// ----------------------------------------------------------------
// Admin Announcements (공지 관리)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/announcements',
    tag: 'Admin',
    summary: '공지 목록 조회 (페이지네이션, 제목 검색 / isActive 필터)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    query: adminAnnouncementListQuerySchema,
    handler: adminAnnouncementCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/announcements',
    tag: 'Admin',
    summary: '공지 생성 (감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    body: adminCreateAnnouncementSchema,
    handler: adminAnnouncementCtrl.create,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/announcements/:announceId',
    tag: 'Admin',
    summary: '공지 수정 (부분 업데이트 / isActive 토글, 감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'announceId', description: '공지 ID' }],
    body: adminUpdateAnnouncementSchema,
    handler: adminAnnouncementCtrl.update,
});

defineRoute(adminRouter, BASE, {
    method: 'delete',
    path: '/announcements/:announceId',
    tag: 'Admin',
    summary: '공지 삭제 (감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'announceId', description: '공지 ID' }],
    handler: adminAnnouncementCtrl.remove,
});

// ----------------------------------------------------------------
// Admin Products (제품 관리)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/products',
    tag: 'Admin',
    summary: '제품 목록 조회 (이름 검색, category·isNew·isPopular·genderTarget 필터, 페이지네이션)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    query: adminProductListQuerySchema,
    handler: adminProductCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/products/:productId',
    tag: 'Admin',
    summary: '제품 상세 조회 (갤러리 이미지 + 연결 태그 포함)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'productId', description: '제품 ID' }],
    handler: adminProductCtrl.detail,
});

defineRoute(adminRouter, BASE, {
    method: 'post',
    path: '/products',
    tag: 'Admin',
    summary: '제품 생성 (이미지·태그 동시 등록, 감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    body: adminCreateProductSchema,
    handler: adminProductCtrl.create,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/products/:productId',
    tag: 'Admin',
    summary: '제품 수정 (부분 업데이트, images/tagIds 명시 시 전체 교체, 감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'productId', description: '제품 ID' }],
    body: adminUpdateProductSchema,
    handler: adminProductCtrl.update,
});

defineRoute(adminRouter, BASE, {
    method: 'delete',
    path: '/products/:productId',
    tag: 'Admin',
    summary: '제품 삭제 (CASCADE: product_images / product_tags / store_products)',
    adminAuth: true,
    adminRoles: ['super_admin', 'content_manager'],
    pathParams: [{ name: 'productId', description: '제품 ID' }],
    handler: adminProductCtrl.remove,
});

// ----------------------------------------------------------------
// Admin Users (회원 관리)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/users',
    tag: 'Admin',
    summary:
        '회원 목록 조회 (이메일/닉네임 검색, status 필터, 페이지네이션). support_staff 토큰은 이메일 마스킹.',
    adminAuth: true,
    adminRoles: ['super_admin', 'support_staff'],
    query: adminUserListQuerySchema,
    handler: adminUserCtrl.list,
});

defineRoute(adminRouter, BASE, {
    method: 'patch',
    path: '/users/:userId/status',
    tag: 'Admin',
    summary: '회원 상태 변경 (1=활성, 0=비활성, -1=탈퇴, 감사 로그 기록)',
    adminAuth: true,
    adminRoles: ['super_admin', 'support_staff'],
    pathParams: [{ name: 'userId', description: '회원 ID' }],
    body: adminUpdateUserStatusSchema,
    handler: adminUserCtrl.updateStatus,
});

// ----------------------------------------------------------------
// Admin Audit Logs (감사 로그 — 읽기 전용, super_admin 전용)
// ----------------------------------------------------------------

defineRoute(adminRouter, BASE, {
    method: 'get',
    path: '/audit-logs',
    tag: 'Admin',
    summary: '감사 로그 목록 조회 (페이지네이션, targetType/action 필터)',
    adminAuth: true,
    adminRoles: ['super_admin'],
    query: adminAuditLogListQuerySchema,
    handler: adminAuditLogCtrl.list,
});
