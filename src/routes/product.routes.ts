import { Router } from 'express';
import * as productCtrl from '../controllers/product.controller';
import { defineRoute } from '../openapi/defineRoute';
import {
    getProductsQuerySchema,
    productDetailQuerySchema,
    mainProductsQuerySchema,
    searchProductsSchema,
} from '../validators/product.schema';

export const productRouter = Router();
const BASE = '/api/v1/products';

defineRoute(productRouter, BASE, {
    method: 'get',
    path: '/',
    tag: 'Product',
    summary: '상품 목록 조회',
    query: getProductsQuerySchema,
    handler: productCtrl.getProducts,
});

defineRoute(productRouter, BASE, {
    method: 'get',
    path: '/detail',
    tag: 'Product',
    summary: '상품 상세 조회 (productId 쿼리)',
    query: productDetailQuerySchema,
    handler: productCtrl.getProductDetail,
});

defineRoute(productRouter, BASE, {
    method: 'get',
    path: '/filter',
    tag: 'Product',
    summary: '메인 노출용 필터 그룹 조회',
    query: mainProductsQuerySchema,
    handler: productCtrl.getMainProductsList,
});

defineRoute(productRouter, BASE, {
    method: 'post',
    path: '/search',
    tag: 'Product',
    summary: '상품 검색 (POST body)',
    body: searchProductsSchema,
    handler: productCtrl.searchProducts,
});
