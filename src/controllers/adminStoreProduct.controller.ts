import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createStoreOverride,
    createStoreProduct,
    deleteStoreOverride,
    deleteStoreProduct,
    listStoreOverrides,
    listStoreProducts,
    updateStoreOverride,
    updateStoreProduct,
} from '../services/adminStoreProduct.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateOverrideInput,
    AdminCreateStoreProductInput,
    AdminUpdateOverrideInput,
    AdminUpdateStoreProductInput,
} from '../validators/admin.schema';

function actorOf(req: Request): AuditActor {
    const { user } = req as AdminAuthRequest;
    return {
        adminId: user.userId,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    };
}

function paramOf(req: Request, name: string): string {
    const value = (req.params as Record<string, string | undefined>)[name];
    if (!value) {
        throw new ValidationError(`${name} 가 필요합니다.`, 'MISSING_PATH_PARAM');
    }
    return value;
}

// ── 가격·재고 (store_products) ────────────────────────────────────

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
    const items = await listStoreProducts(paramOf(req, 'storeId'));
    success(res, { items });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateStoreProductInput;
    const row = await createStoreProduct(paramOf(req, 'storeId'), input, actorOf(req));
    success(res, row, '매장 상품 가격·재고가 등록되었습니다.');
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminUpdateStoreProductInput;
    const row = await updateStoreProduct(
        paramOf(req, 'storeId'),
        paramOf(req, 'storeProductId'),
        input,
        actorOf(req),
    );
    success(res, row, '가격·재고가 수정되었습니다.');
});

export const removeProduct = asyncHandler(async (req: Request, res: Response) => {
    await deleteStoreProduct(
        paramOf(req, 'storeId'),
        paramOf(req, 'storeProductId'),
        actorOf(req),
    );
    success(res, null, '매장 상품이 삭제되었습니다.');
});

// ── 매장별 카탈로그 오버라이드 (store_product_overrides) ────────────

export const listCatalog = asyncHandler(async (req: Request, res: Response) => {
    const items = await listStoreOverrides(paramOf(req, 'storeId'));
    success(res, { items });
});

export const createCatalog = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateOverrideInput;
    const row = await createStoreOverride(paramOf(req, 'storeId'), input, actorOf(req));
    success(res, row, '매장 카탈로그 항목이 추가되었습니다.');
});

export const updateCatalog = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminUpdateOverrideInput;
    const row = await updateStoreOverride(
        paramOf(req, 'storeId'),
        paramOf(req, 'overrideId'),
        input,
        actorOf(req),
    );
    success(res, row, '카탈로그 항목이 수정되었습니다.');
});

export const removeCatalog = asyncHandler(async (req: Request, res: Response) => {
    await deleteStoreOverride(
        paramOf(req, 'storeId'),
        paramOf(req, 'overrideId'),
        actorOf(req),
    );
    success(res, null, '카탈로그 항목이 삭제되었습니다.');
});
