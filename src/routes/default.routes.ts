import { Router } from 'express';
import * as defaultCtrl from '../controllers/default.controller';
import { defineRoute } from '../openapi/defineRoute';
import { tagQuerySchema, inquirySchema } from '../validators/default.schema';
import { imageUpload } from '../middleware/upload.middleware';

export const defaultRouter = Router();
const BASE = '/api/v1';

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
    method: 'get',
    path: '/banners',
    tag: 'Banner',
    summary: '활성 배너 목록 (sort_order 순)',
    handler: defaultCtrl.getBannerList,
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
    pre: [imageUpload.single('image')],
    handler: defaultCtrl.uploadImage,
});
