-- 0009_seed_banners.sql
-- 기존 프론트 정적 배너 2장을 초기 배너로 시드. 이미지는 uploads/sample 에 복사돼 있음.
-- banner_id 를 고정해 재실행/롤백 시에도 동일 ID 유지. link_url 은 우선 google 로.

INSERT INTO banners (banner_id, title, image_url, link_url, sort_order, is_active)
VALUES
    ('22222222-2222-2222-2222-000000000001', '샘플 배너 1', '/uploads/sample/sample-banner.jpeg', 'https://www.google.com', 0, TRUE),
    ('22222222-2222-2222-2222-000000000002', '샘플 배너 2', '/uploads/sample/sample-banner-2.png', 'https://www.google.com', 1, TRUE)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    image_url = VALUES(image_url),
    link_url = VALUES(link_url),
    sort_order = VALUES(sort_order),
    is_active = VALUES(is_active);
