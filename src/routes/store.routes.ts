import { Router } from 'express';
import * as storeCtrl from '../controllers/store.controller';
import { validate } from '../middleware/validate.middleware';
import {
    nearbyStoresSchema,
    storeByIdQuerySchema,
    storeByProductQuerySchema,
} from '../validators/store.schema';

export const storeRouter = Router();

storeRouter.get('/', validate(storeByIdQuerySchema, 'query'), storeCtrl.getStore);

storeRouter.post('/nearby', validate(nearbyStoresSchema), storeCtrl.getNearStoreList);

storeRouter.get(
    '/product',
    validate(storeByProductQuerySchema, 'query'),
    storeCtrl.getStoreGachaList,
);
