import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as defaultCtrl from '../controllers/default.controller';
import { defineRoute } from '../openapi/defineRoute';
import { tagQuerySchema, inquirySchema } from '../validators/default.schema';

export const defaultRouter = Router();
const BASE = '/api/v1';

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

defineRoute(defaultRouter, BASE, {
    method: 'get',
    path: '/tag/tags',
    tag: 'Tag',
    summary: '태그 목록 조회 (RelationType 쿼리 옵션)',
    query: tagQuerySchema,
    handler: defaultCtrl.getTagList,
});

defineRoute(defaultRouter, BASE, {
    method: 'get',
    path: '/announces',
    tag: 'Announcement',
    summary: '활성 공지사항 목록',
    handler: defaultCtrl.getAnnouncementList,
});

defineRoute(defaultRouter, BASE, {
    method: 'post',
    path: '/inquiry',
    tag: 'Inquiry',
    summary: '문의 등록',
    auth: true,
    body: inquirySchema,
    handler: defaultCtrl.postInquiry,
});

defineRoute(defaultRouter, BASE, {
    method: 'get',
    path: '/inquiry',
    tag: 'Inquiry',
    summary: '내 문의 목록',
    auth: true,
    handler: defaultCtrl.getInquiryList,
});

defineRoute(defaultRouter, BASE, {
    method: 'post',
    path: '/images',
    tag: 'Upload',
    summary: '이미지 업로드 (multipart/form-data, field=image, max 5MB)',
    auth: true,
    pre: [upload.single('image')],
    handler: defaultCtrl.uploadImage,
});
