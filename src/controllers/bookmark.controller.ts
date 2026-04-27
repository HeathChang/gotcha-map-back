import { Response } from 'express';
import * as bookmarkService from '../services/bookmark.service';
import { AuthRequest } from '../types';
import { AuthenticationError } from '../utils/errors';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { BookmarkInput } from '../validators/bookmark.schema';

function getUserId(req: AuthRequest): string {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    return userId;
}

export const addBookmark = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    const { type, targetId } = req.body as BookmarkInput;
    await bookmarkService.addBookmark(userId, targetId, type);
    success(res, null, '북마크가 추가되었습니다.', 201);
});

export const deleteBookmark = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    const { type, targetId } = req.body as BookmarkInput;
    await bookmarkService.deleteBookmark(userId, targetId, type);
    success(res, null, '북마크가 삭제되었습니다.');
});

export const getStoreBookmarks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    const bookmarks = await bookmarkService.getStoreBookmarks(userId);
    success(res, bookmarks);
});

export const getProductBookmarks = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    const bookmarks = await bookmarkService.getProductBookmarks(userId);
    success(res, bookmarks);
});
