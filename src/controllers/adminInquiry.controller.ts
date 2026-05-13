import { Request, Response } from 'express';
import { AdminAuthRequest } from '../types';
import {
    answerAdminInquiry,
    getAdminInquiryStats,
    listAdminInquiries,
} from '../services/adminInquiry.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors';
import type {
    AdminAnswerInquiryInput,
    AdminInquiryListQuery,
} from '../validators/admin.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { status, q, page, limit } = req.query as unknown as AdminInquiryListQuery;
    const result = await listAdminInquiries({ status, q, page, limit });
    success(res, result);
});

export const stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await getAdminInquiryStats();
    success(res, result);
});

export const answer = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AdminAuthRequest;
    const inquiryId = (req.params as { inquiryId?: string }).inquiryId;
    if (!inquiryId) {
        throw new ValidationError('inquiryId 가 필요합니다.', 'MISSING_INQUIRY_ID');
    }
    const { status, answer: answerText } = req.body as AdminAnswerInquiryInput;

    const updated = await answerAdminInquiry({
        inquiryId,
        adminId: user.userId,
        status,
        answer: answerText,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
    });
    success(res, updated);
});
