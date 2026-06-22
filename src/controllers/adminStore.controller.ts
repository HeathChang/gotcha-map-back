import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createStore,
    deleteStore,
    getStore,
    listStoresForAdmin,
    updateStore,
} from '../services/store.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateStoreInput,
    AdminStoreListQuery,
    AdminUpdateStoreInput,
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
    const { q, page, limit } = req.query as unknown as AdminStoreListQuery;
    const result = await listStoresForAdmin({ q, page, limit });
    success(res, result);
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
    const storeId = (req.params as { storeId?: string }).storeId;
    if (!storeId) {
        throw new ValidationError('storeId 가 필요합니다.', 'MISSING_STORE_ID');
    }
    const store = await getStore(storeId);
    success(res, store);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateStoreInput;
    const store = await createStore(input, actorOf(req));
    success(res, store, '매장이 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const storeId = (req.params as { storeId?: string }).storeId;
    if (!storeId) {
        throw new ValidationError('storeId 가 필요합니다.', 'MISSING_STORE_ID');
    }
    const input = { ...(req.body as AdminUpdateStoreInput) };
    // 평점(rating)은 운영 큐레이션 값 — member(점주)가 자기 매장 평점을 직접 올리지 못하게 서버에서 차단.
    if ((req as AdminAuthRequest).user.role === 'member') {
        delete input.rating;
    }
    const store = await updateStore(storeId, input, actorOf(req));
    success(res, store, '매장이 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const storeId = (req.params as { storeId?: string }).storeId;
    if (!storeId) {
        throw new ValidationError('storeId 가 필요합니다.', 'MISSING_STORE_ID');
    }
    await deleteStore(storeId, actorOf(req));
    success(res, null, '매장이 삭제되었습니다.');
});
