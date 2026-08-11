-- 0008_banners.sql
-- 홈 화면 배너. admin 에서 이미지 업로드/관리, 프론트는 활성 배너를 sort_order 순으로 노출.
-- link_url 은 추후 배너 탭 시 이동용(현재 프론트는 미사용).

CREATE TABLE IF NOT EXISTS banners (
    banner_id   VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    title       VARCHAR(255) DEFAULT NULL,
    image_url   VARCHAR(512) NOT NULL,
    link_url    VARCHAR(512) DEFAULT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_banners_active_order (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
