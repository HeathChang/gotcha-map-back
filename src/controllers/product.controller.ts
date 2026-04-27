import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import {
    GetProductsQuery,
    SearchProductsInput,
    Filter,
} from '../validators/product.schema';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as GetProductsQuery;
    const result = await productService.getProducts(params);
    success(res, result);
});

export const getProductDetail = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.query as { productId: string };
    const product = await productService.getProductDetail(productId);
    success(res, product);
});

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const result = await productService.searchProducts(req.body as SearchProductsInput);
    success(res, result);
});

export const getMainProductsList = asyncHandler(async (req: Request, res: Response) => {
    const { filters } = req.query as unknown as { filters?: Filter[] };
    const filterArr: Filter[] = filters && filters.length > 0 ? filters : ['POPULAR', 'NEW'];
    const result = await productService.getMainProductsList(filterArr);
    success(res, result);
});
