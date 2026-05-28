import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createTag,
    deleteTag,
    listTagsForAdmin,
    updateTag,
    type AuditActor,
} from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateTagInput,
    AdminTagListQuery,
    AdminUpdateTagInput,
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
    const { q, relationType, page, limit } = req.query as unknown as AdminTagListQuery;
    const result = await listTagsForAdmin({ q, relationType, page, limit });
    success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateTagInput;
    const tag = await createTag(input, actorOf(req));
    success(res, tag, '태그가 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const tagId = (req.params as { tagId?: string }).tagId;
    if (!tagId) {
        throw new ValidationError('tagId 가 필요합니다.', 'MISSING_TAG_ID');
    }
    const input = req.body as AdminUpdateTagInput;
    const tag = await updateTag(tagId, input, actorOf(req));
    success(res, tag, '태그가 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const tagId = (req.params as { tagId?: string }).tagId;
    if (!tagId) {
        throw new ValidationError('tagId 가 필요합니다.', 'MISSING_TAG_ID');
    }
    await deleteTag(tagId, actorOf(req));
    success(res, null, '태그가 삭제되었습니다.');
});
