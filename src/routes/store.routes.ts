import { Router } from 'express';
import * as storeCtrl from '../controllers/store.controller';
import { defineRoute } from '../openapi/defineRoute';
import {
    nearbyStoresSchema,
    storeByIdQuerySchema,
    storeByProductQuerySchema,
} from '../validators/store.schema';

export const storeRouter = Router();
const BASE = '/api/v1/store';

defineRoute(storeRouter, BASE, {
    method: 'get',
    path: '/',
    tag: 'Store',
    summary: '매장 단건 조회 (storeId 쿼리)',
    query: storeByIdQuerySchema,
    handler: storeCtrl.getStore,
});

defineRoute(storeRouter, BASE, {
    method: 'post',
    path: '/nearby',
    tag: 'Store',
    summary: '주변 매장 조회 (위경도 + 반경 km)',
    body: nearbyStoresSchema,
    handler: storeCtrl.getNearStoreList,
});

defineRoute(storeRouter, BASE, {
    method: 'get',
    path: '/product',
    tag: 'Store',
    summary: '특정 상품을 취급하는 매장 목록',
    query: storeByProductQuerySchema,
    handler: storeCtrl.getStoreGachaList,
});
