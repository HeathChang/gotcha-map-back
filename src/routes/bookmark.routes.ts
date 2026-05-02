import { Router } from 'express';
import * as bookmarkCtrl from '../controllers/bookmark.controller';
import { defineRoute } from '../openapi/defineRoute';
import { bookmarkBodySchema } from '../validators/bookmark.schema';

export const bookmarkRouter = Router();
const BASE = '/api/v1/bookmarks';

defineRoute(bookmarkRouter, BASE, {
    method: 'post',
    path: '/',
    tag: 'Bookmark',
    summary: '북마크 추가',
    auth: true,
    body: bookmarkBodySchema,
    handler: bookmarkCtrl.addBookmark,
});

defineRoute(bookmarkRouter, BASE, {
    method: 'delete',
    path: '/',
    tag: 'Bookmark',
    summary: '북마크 삭제',
    auth: true,
    body: bookmarkBodySchema,
    handler: bookmarkCtrl.deleteBookmark,
});

defineRoute(bookmarkRouter, BASE, {
    method: 'get',
    path: '/stores',
    tag: 'Bookmark',
    summary: '내 매장 북마크 목록',
    auth: true,
    handler: bookmarkCtrl.getStoreBookmarks,
});

defineRoute(bookmarkRouter, BASE, {
    method: 'get',
    path: '/products',
    tag: 'Bookmark',
    summary: '내 상품 북마크 목록',
    auth: true,
    handler: bookmarkCtrl.getProductBookmarks,
});
