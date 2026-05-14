import { Request, Response } from 'express';
import {
    createStore,
    deleteStore,
    listStoresForAdmin,
    updateStore,
} from '../services/store.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateStoreInput,
    AdminStoreListQuery,
    AdminUpdateStoreInput,
} from '../validators/admin.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as unknown as AdminStoreListQuery;
    const result = await listStoresForAdmin({ q, page, limit });
    success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateStoreInput;
    const store = await createStore(input);
    success(res, store, '매장이 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const storeId = (req.params as { storeId?: string }).storeId;
    if (!storeId) {
        throw new ValidationError('storeId 가 필요합니다.', 'MISSING_STORE_ID');
    }
    const input = req.body as AdminUpdateStoreInput;
    const store = await updateStore(storeId, input);
    success(res, store, '매장이 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const storeId = (req.params as { storeId?: string }).storeId;
    if (!storeId) {
        throw new ValidationError('storeId 가 필요합니다.', 'MISSING_STORE_ID');
    }
    await deleteStore(storeId);
    success(res, null, '매장이 삭제되었습니다.');
});
