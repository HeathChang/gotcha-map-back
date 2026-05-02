import { Router } from 'express';
import { userRouter } from './user.routes';
import { productRouter } from './product.routes';
import { storeRouter } from './store.routes';
import { bookmarkRouter } from './bookmark.routes';
import { defaultRouter } from './default.routes';
import { authRouter } from './auth.routes';

export const router = Router();

// v1 계약 유지(api-design.md: Breaking change는 새 버전). 네이밍 정합(복수형/동사 제거)은 v2에서 반영.
// - TODO(api v2): /signup, /login → /auth/signup, /auth/login
// - TODO(api v2): /store → /stores, /tag/tags → /tags, /announces → /announcements
// - TODO(api v2): 쿼리파라미터 대문자(RelationType) → camelCase 통일
// - TODO(api v2): 오프셋 페이지네이션 → 커서 기반(nextCursor)

// POST /api/v1/auth/refresh, POST /api/v1/auth/logout
router.use('/auth', authRouter);

// POST /api/v1/signup, POST /api/v1/login, GET /api/v1/users, ...
router.use('/', userRouter);

// GET /api/v1/products, GET /api/v1/products/detail, ...
router.use('/products', productRouter);

// GET /api/v1/store, POST /api/v1/store/nearby, ...
router.use('/store', storeRouter);

// POST /api/v1/bookmarks, GET /api/v1/bookmarks/stores, ...
router.use('/bookmarks', bookmarkRouter);

// GET /api/v1/tag/tags, GET /api/v1/announces, ...
router.use('/', defaultRouter);
