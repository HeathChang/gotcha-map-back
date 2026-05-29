import { Request, Response } from 'express';
import { AdminAuthRequest, AdminRole } from '../types';
import {
    listUsersForAdmin,
    updateUserStatus,
} from '../services/adminUser.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminUpdateUserStatusInput,
    AdminUserListQuery,
} from '../validators/admin.schema';

function actorOf(req: Request): AuditActor & { role: AdminRole } {
    const { user } = req as AdminAuthRequest;
    return {
        adminId: user.userId,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        role: user.role,
    };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { q, status, page, limit } = req.query as unknown as AdminUserListQuery;
    const actor = actorOf(req);
    const result = await listUsersForAdmin({
        q,
        status,
        page,
        limit,
        actorRole: actor.role,
    });
    success(res, result);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.params as { userId?: string }).userId;
    if (!userId) {
        throw new ValidationError('userId 가 필요합니다.', 'MISSING_USER_ID');
    }
    const { status } = req.body as AdminUpdateUserStatusInput;
    const user = await updateUserStatus(userId, status, actorOf(req));
    success(res, user, '회원 상태가 변경되었습니다.');
});
