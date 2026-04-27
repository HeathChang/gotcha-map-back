import { Router } from 'express';
import * as productCtrl from '../controllers/product.controller';
import { validate } from '../middleware/validate.middleware';
import {
    getProductsQuerySchema,
    productDetailQuerySchema,
    mainProductsQuerySchema,
    searchProductsSchema,
} from '../validators/product.schema';

export const productRouter = Router();

productRouter.get('/', validate(getProductsQuerySchema, 'query'), productCtrl.getProducts);

productRouter.get(
    '/detail',
    validate(productDetailQuerySchema, 'query'),
    productCtrl.getProductDetail,
);

productRouter.get(
    '/filter',
    validate(mainProductsQuerySchema, 'query'),
    productCtrl.getMainProductsList,
);

productRouter.post('/search', validate(searchProductsSchema), productCtrl.searchProducts);
