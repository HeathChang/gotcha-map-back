-- ================================================================
-- Migration 0011: 매장별 카탈로그 오버라이드 (gotcha-map-policy/README.md §5, 옵션 A)
--   member(점주)가 자기 매장에서 파는 제품의 카탈로그를 추가/보강한다.
--     - product_id NULL  = 매장 신규 추가 상품(공용 카탈로그에 없음). price/stock 사용.
--     - product_id 설정  = 기존 상품 내용 보강(이름/설명/이미지). 가격·재고 정본은 store_products.
--   소비자 앱(옵션 A)은 [products ⋈ store_products] + store_product_overrides 를 함께 노출.
--   공용 products 테이블은 member 가 직접 변경하지 않는다(오염 방지).
-- ================================================================
CREATE TABLE IF NOT EXISTS store_product_overrides (
    override_id         VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    store_id            VARCHAR(36)  NOT NULL,
    product_id          VARCHAR(36)  DEFAULT NULL COMMENT 'NULL=매장 신규 추가 상품',
    product_name        VARCHAR(255) NOT NULL,
    product_info        TEXT         DEFAULT NULL,
    image_url           VARCHAR(512) DEFAULT NULL,
    price               INT          NOT NULL DEFAULT 0,
    stock               INT          DEFAULT NULL,
    created_by_admin_id VARCHAR(36)  DEFAULT NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL,
    INDEX idx_spo_store (store_id),
    INDEX idx_spo_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
