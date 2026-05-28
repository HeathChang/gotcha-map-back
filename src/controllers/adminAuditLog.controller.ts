import { Request, Response } from 'express';
import { listAuditLogsForAdmin } from '../services/adminAuditLog.service';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import type { AdminAuditLogListQuery } from '../validators/admin.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
    const { targetType, action, page, limit } =
        req.query as unknown as AdminAuditLogListQuery;
    const result = await listAuditLogsForAdmin({ targetType, action, page, limit });
    success(res, result);
});
