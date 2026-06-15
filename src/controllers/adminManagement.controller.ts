import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createAdmin,
    listAdmins,
    resetAdminPassword,
    updateAdminStatus,
} from '../services/adminManagement.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateAdminInput,
    AdminListAdminsQuery,
    AdminResetAdminPasswordInput,
    AdminUpdateAdminStatusInput,
} from '../validators/admin.schema';

function actorOf(req: Request): AuditActor {
    const { user } = req as AdminAuthRequest;
    return {
        adminId: user.userId,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    };
}

function adminIdParam(req: Request): string {
    const value = (req.params as { adminId?: string }).adminId;
    if (!value) {
        throw new ValidationError('adminId 가 필요합니다.', 'MISSING_ADMIN_ID');
    }
    return value;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { q, role, page, limit } = req.query as unknown as AdminListAdminsQuery;
    const result = await listAdmins({ q, role, page, limit });
    success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateAdminInput;
    const admin = await createAdmin(input, actorOf(req));
    success(res, admin, '운영자 계정이 생성되었습니다.');
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as AdminUpdateAdminStatusInput;
    const admin = await updateAdminStatus(adminIdParam(req), status, actorOf(req));
    success(res, admin, '운영자 상태가 변경되었습니다.');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body as AdminResetAdminPasswordInput;
    await resetAdminPassword(adminIdParam(req), password, actorOf(req));
    success(res, null, '비밀번호가 재설정되었습니다.');
});
