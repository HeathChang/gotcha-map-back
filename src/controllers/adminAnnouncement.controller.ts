import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createAnnouncement,
    deleteAnnouncement,
    listAnnouncementsForAdmin,
    updateAnnouncement,
} from '../services/adminAnnouncement.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminAnnouncementListQuery,
    AdminCreateAnnouncementInput,
    AdminUpdateAnnouncementInput,
} from '../validators/admin.schema';

function actorOf(req: Request): AuditActor {
    const { user } = req as AdminAuthRequest;
    return {
        adminId: user.userId,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { q, isActive, page, limit } =
        req.query as unknown as AdminAnnouncementListQuery;
    const result = await listAnnouncementsForAdmin({ q, isActive, page, limit });
    success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateAnnouncementInput;
    const announcement = await createAnnouncement(input, actorOf(req));
    success(res, announcement, '공지가 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const announceId = (req.params as { announceId?: string }).announceId;
    if (!announceId) {
        throw new ValidationError('announceId 가 필요합니다.', 'MISSING_ANNOUNCE_ID');
    }
    const input = req.body as AdminUpdateAnnouncementInput;
    const announcement = await updateAnnouncement(announceId, input, actorOf(req));
    success(res, announcement, '공지가 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const announceId = (req.params as { announceId?: string }).announceId;
    if (!announceId) {
        throw new ValidationError('announceId 가 필요합니다.', 'MISSING_ANNOUNCE_ID');
    }
    await deleteAnnouncement(announceId, actorOf(req));
    success(res, null, '공지가 삭제되었습니다.');
});
