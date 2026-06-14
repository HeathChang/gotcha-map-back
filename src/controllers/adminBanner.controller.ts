import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createBanner,
    deleteBanner,
    listBannersForAdmin,
    updateBanner,
} from '../services/adminBanner.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminBannerListQuery,
    AdminCreateBannerInput,
    AdminUpdateBannerInput,
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
    const { q, isActive, page, limit } = req.query as unknown as AdminBannerListQuery;
    const result = await listBannersForAdmin({ q, isActive, page, limit });
    success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateBannerInput;
    const banner = await createBanner(input, actorOf(req));
    success(res, banner, '배너가 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const bannerId = (req.params as { bannerId?: string }).bannerId;
    if (!bannerId) {
        throw new ValidationError('bannerId 가 필요합니다.', 'MISSING_BANNER_ID');
    }
    const input = req.body as AdminUpdateBannerInput;
    const banner = await updateBanner(bannerId, input, actorOf(req));
    success(res, banner, '배너가 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const bannerId = (req.params as { bannerId?: string }).bannerId;
    if (!bannerId) {
        throw new ValidationError('bannerId 가 필요합니다.', 'MISSING_BANNER_ID');
    }
    await deleteBanner(bannerId, actorOf(req));
    success(res, null, '배너가 삭제되었습니다.');
});
