import { Request, Response } from 'express';
import * as defaultService from '../services/default.service';
import { AuthRequest } from '../types';
import { AuthenticationError, ValidationError } from '../utils/errors';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { InquiryInput } from '../validators/default.schema';

export const getTagList = asyncHandler(async (req: Request, res: Response) => {
    // TODO(api v2): 파라미터명을 camelCase(`relationType`)로 통일. v1 계약 유지를 위해 현재 PascalCase 보존.
    const { RelationType } = req.query as { RelationType?: string };
    const tags = await defaultService.getTagList(RelationType);
    success(res, tags);
});

export const getAnnouncementList = asyncHandler(async (_req: Request, res: Response) => {
    const list = await defaultService.getAnnouncementList();
    success(res, list);
});

export const postInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    const { title, content, category, email } = req.body as InquiryInput;
    const inquiry = await defaultService.postInquiry(userId, title, content, category, email);
    success(res, inquiry, '문의가 접수되었습니다.', 201);
});

export const getInquiryList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    const list = await defaultService.getInquiryList(userId);
    success(res, list);
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError('이미지 파일이 필요합니다.', 'IMAGE_REQUIRED');
    const imageUrl = `/uploads/${req.file.filename}`;
    success(res, { imageUrl }, '이미지가 업로드되었습니다.', 201);
});
