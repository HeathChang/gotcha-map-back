import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    createProduct,
    deleteProduct,
    getProductDetail,
    listProductsForAdmin,
    updateProduct,
} from '../services/adminProduct.service';
import type { AuditActor } from '../services/adminTag.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminCreateProductInput,
    AdminProductListQuery,
    AdminUpdateProductInput,
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
    const { q, category, isNew, isPopular, genderTarget, page, limit } =
        req.query as unknown as AdminProductListQuery;
    const result = await listProductsForAdmin({
        q,
        category,
        isNew,
        isPopular,
        genderTarget,
        page,
        limit,
    });
    success(res, result);
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
    const productId = (req.params as { productId?: string }).productId;
    if (!productId) {
        throw new ValidationError('productId 가 필요합니다.', 'MISSING_PRODUCT_ID');
    }
    const product = await getProductDetail(productId);
    success(res, product);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as AdminCreateProductInput;
    const product = await createProduct(input, actorOf(req));
    success(res, product, '제품이 생성되었습니다.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
    const productId = (req.params as { productId?: string }).productId;
    if (!productId) {
        throw new ValidationError('productId 가 필요합니다.', 'MISSING_PRODUCT_ID');
    }
    const input = req.body as AdminUpdateProductInput;
    const product = await updateProduct(productId, input, actorOf(req));
    success(res, product, '제품이 수정되었습니다.');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
    const productId = (req.params as { productId?: string }).productId;
    if (!productId) {
        throw new ValidationError('productId 가 필요합니다.', 'MISSING_PRODUCT_ID');
    }
    await deleteProduct(productId, actorOf(req));
    success(res, null, '제품이 삭제되었습니다.');
});
