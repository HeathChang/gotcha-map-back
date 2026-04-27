import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as defaultCtrl from '../controllers/default.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { tagQuerySchema, inquirySchema } from '../validators/default.schema';

export const defaultRouter = Router();

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const ok = ALLOWED_EXTS.has(ext) && ALLOWED_MIME.has(file.mimetype);
        cb(null, ok);
    },
});

defaultRouter.get('/tag/tags', validate(tagQuerySchema, 'query'), defaultCtrl.getTagList);

defaultRouter.get('/announces', defaultCtrl.getAnnouncementList);

defaultRouter.post(
    '/inquiry',
    authMiddleware,
    validate(inquirySchema),
    defaultCtrl.postInquiry,
);

defaultRouter.get('/inquiry', authMiddleware, defaultCtrl.getInquiryList);

defaultRouter.post(
    '/images',
    authMiddleware,
    upload.single('image'),
    defaultCtrl.uploadImage,
);
