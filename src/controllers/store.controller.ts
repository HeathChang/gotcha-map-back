import { Request, Response } from 'express';
import * as storeService from '../services/store.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { NearbyStoresInput } from '../validators/store.schema';

export const getNearStoreList = asyncHandler(async (req: Request, res: Response) => {
    const { lat, lon, radiusKm } = req.body as NearbyStoresInput;
    const stores = await storeService.getNearStoreList(lat, lon, radiusKm);
    success(res, stores);
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId: string };
    const store = await storeService.getStore(storeId);
    success(res, store);
});

export const getStoreGachaList = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.query as { productId: string };
    const stores = await storeService.getStoreGachaList(productId);
    success(res, stores);
});
