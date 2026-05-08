import { Request } from 'express';

// ================================================================
// 공통 타입
// ================================================================
export interface ApiResponse<T = unknown> {
    data: T;
    message?: string;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginationResult {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
}

// JWT 토큰 페이로드
//   kind 미지정 또는 'user' = 일반 사용자 토큰 (기존 호환).
//   'admin' = 어드민 토큰. role 필수. adminAuth 미들웨어가 kind 일치를 강제한다.
export type AdminRole = 'super_admin' | 'content_manager' | 'support_staff';

export interface JwtPayload {
    userId: string;
    email: string;
    kind?: 'user' | 'admin';
    role?: AdminRole;
}

// 인증된 요청
export interface AuthRequest extends Request {
    user?: JwtPayload;
}

// 어드민 인증된 요청 — adminAuth 미들웨어 통과 후에는 role/kind 가 보장된다.
export interface AdminAuthRequest extends Request {
    user: Required<Pick<JwtPayload, 'userId' | 'email'>> & {
        kind: 'admin';
        role: AdminRole;
    };
}

// ================================================================
// User
// ================================================================
export interface UserRow {
    user_id: string;
    email: string;
    password: string;
    nickname: string;
    gender: 'M' | 'F' | null;
    profile_image_url: string | null;
    user_status: number;
    user_flag: number;
    created_at: Date;
    updated_at: Date;
}

// ================================================================
// Product
// ================================================================
export type FilterType = 'FEMALE' | 'MALE' | 'POPULAR' | 'NEW';

export interface ProductRow {
    product_id: string;
    product_name: string;
    product_manufacturer: string | null;
    product_info: string | null;
    category: string | null;
    min_price: number;
    max_price: number;
    image_url: string | null;
    view_count: number;
    is_new: boolean;
    is_popular: boolean;
    gender_target: 'M' | 'F' | 'ALL';
    created_at: Date;
    updated_at: Date;
}

// ================================================================
// Store
// ================================================================
export interface StoreRow {
    store_id: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    phone: string | null;
    description: string | null;
    image_url: string | null;
    opening_hours: string | null;
    rating: number;
    created_at: Date;
    updated_at: Date;
}

// ================================================================
// Bookmark
// ================================================================
export type BookmarkType = 'store' | 'product';

export interface BookmarkRow {
    bookmark_id: string;
    user_id: string;
    target_id: string;
    type: BookmarkType;
    created_at: Date;
}

// ================================================================
// Announcement
// ================================================================
export interface AnnouncementRow {
    announce_id: string;
    title: string;
    content: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

// ================================================================
// Inquiry
// ================================================================
export type InquiryStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface InquiryRow {
    inquiry_id: string;
    user_id: string;
    title: string;
    content: string;
    category: string | null;
    email: string | null;
    status: InquiryStatus;
    answer: string | null;
    answered_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

// ================================================================
// Tag
// ================================================================
export interface TagRow {
    tag_id: string;
    name: string;
    relation_type: string | null;
    created_at: Date;
}

// ================================================================
// Admin (백오피스)
// ================================================================
export interface AdminUserRow {
    admin_id: string;
    email: string;
    password: string;
    name: string;
    role: AdminRole;
    admin_status: number;
    created_at: Date;
    updated_at: Date;
}

export interface AdminAuditLogRow {
    audit_id: string;
    admin_id: string;
    action: string;
    target_type: string;
    target_id: string;
    diff: unknown;
    ip: string | null;
    user_agent: string | null;
    created_at: Date;
}
