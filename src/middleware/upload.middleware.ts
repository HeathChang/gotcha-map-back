import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 이미지 업로드 공통 설정. 유저(/api/v1/images)·어드민(/api/v1/admin/images) 라우트가 공유.
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'uploads/'),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    },
});

export const imageUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const ok = ALLOWED_EXTS.has(ext) && ALLOWED_MIME.has(file.mimetype);
        cb(null, ok);
    },
});
