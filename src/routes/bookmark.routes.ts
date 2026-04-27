import { Router } from 'express';
import * as bookmarkCtrl from '../controllers/bookmark.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { bookmarkBodySchema } from '../validators/bookmark.schema';

export const bookmarkRouter = Router();

bookmarkRouter.use(authMiddleware);

bookmarkRouter.post('/', validate(bookmarkBodySchema), bookmarkCtrl.addBookmark);

bookmarkRouter.delete('/', validate(bookmarkBodySchema), bookmarkCtrl.deleteBookmark);

bookmarkRouter.get('/stores', bookmarkCtrl.getStoreBookmarks);

bookmarkRouter.get('/products', bookmarkCtrl.getProductBookmarks);
