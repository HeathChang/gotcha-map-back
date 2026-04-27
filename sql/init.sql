-- ================================================================
-- GachaMap Database Schema
-- MariaDB 10.6+
-- ================================================================

CREATE DATABASE IF NOT EXISTS gachamap
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE gachamap;

-- ================================================================
-- 1. 사용자 (Users)
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,
    nickname      VARCHAR(50)  NOT NULL,
    gender        ENUM('M', 'F') DEFAULT NULL,
    profile_image_url VARCHAR(512) DEFAULT NULL,
    user_status   TINYINT      NOT NULL DEFAULT 1 COMMENT '1=활성, 0=비활성, -1=탈퇴',
    user_flag     INT          NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- ================================================================
-- 2. 태그 (Tags)
-- ================================================================
CREATE TABLE IF NOT EXISTS tags (
    tag_id        VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    name          VARCHAR(100) NOT NULL,
    relation_type VARCHAR(50)  DEFAULT NULL COMMENT '태그 분류 (예: CATEGORY, THEME 등)',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tags_relation (relation_type)
) ENGINE=InnoDB;

-- ================================================================
-- 3. 상품 (Products)
-- ================================================================
CREATE TABLE IF NOT EXISTS products (
    product_id          VARCHAR(36)    PRIMARY KEY DEFAULT (UUID()),
    product_name        VARCHAR(255)   NOT NULL,
    product_manufacturer VARCHAR(255)  DEFAULT NULL,
    product_info        TEXT           DEFAULT NULL,
    category            VARCHAR(100)   DEFAULT NULL,
    min_price           INT            NOT NULL DEFAULT 0,
    max_price           INT            NOT NULL DEFAULT 0,
    image_url           VARCHAR(512)   DEFAULT NULL,
    view_count          INT            NOT NULL DEFAULT 0,
    is_new              BOOLEAN        NOT NULL DEFAULT FALSE,
    is_popular          BOOLEAN        NOT NULL DEFAULT FALSE,
    gender_target       ENUM('M', 'F', 'ALL') NOT NULL DEFAULT 'ALL',
    created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_products_category (category),
    INDEX idx_products_popular (is_popular),
    INDEX idx_products_new (is_new),
    INDEX idx_products_gender (gender_target)
) ENGINE=InnoDB;

-- ================================================================
-- 4. 상품 이미지 (Product Images)
-- ================================================================
CREATE TABLE IF NOT EXISTS product_images (
    id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    product_id    VARCHAR(36)  NOT NULL,
    image_url     VARCHAR(512) NOT NULL,
    sort_order    INT          NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_images_product (product_id)
) ENGINE=InnoDB;

-- ================================================================
-- 5. 상품-태그 매핑 (Product Tags)
-- ================================================================
CREATE TABLE IF NOT EXISTS product_tags (
    id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    product_id    VARCHAR(36)  NOT NULL,
    tag_id        VARCHAR(36)  NOT NULL,

    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE,
    UNIQUE KEY uk_product_tag (product_id, tag_id)
) ENGINE=InnoDB;

-- ================================================================
-- 6. 매장 (Stores)
-- ================================================================
CREATE TABLE IF NOT EXISTS stores (
    store_id      VARCHAR(36)    PRIMARY KEY DEFAULT (UUID()),
    name          VARCHAR(255)   NOT NULL,
    address       VARCHAR(500)   NOT NULL,
    lat           DECIMAL(10, 7) NOT NULL,
    lon           DECIMAL(10, 7) NOT NULL,
    phone         VARCHAR(20)    DEFAULT NULL,
    description   TEXT           DEFAULT NULL,
    image_url     VARCHAR(512)   DEFAULT NULL,
    opening_hours VARCHAR(255)   DEFAULT NULL,
    rating        DECIMAL(2, 1)  DEFAULT 0.0,
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_stores_location (lat, lon)
) ENGINE=InnoDB;

-- ================================================================
-- 7. 매장-상품 매핑 (Store Products) — 가격 비교용
-- ================================================================
CREATE TABLE IF NOT EXISTS store_products (
    id            VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    store_id      VARCHAR(36)  NOT NULL,
    product_id    VARCHAR(36)  NOT NULL,
    price         INT          NOT NULL DEFAULT 0,
    stock         INT          DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE KEY uk_store_product (store_id, product_id),
    INDEX idx_store_products_product (product_id)
) ENGINE=InnoDB;

-- ================================================================
-- 8. 북마크 (Bookmarks)
-- ================================================================
CREATE TABLE IF NOT EXISTS bookmarks (
    bookmark_id   VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    user_id       VARCHAR(36)  NOT NULL,
    target_id     VARCHAR(36)  NOT NULL,
    type          ENUM('store', 'product') NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_bookmark (user_id, target_id, type),
    INDEX idx_bookmarks_user (user_id),
    INDEX idx_bookmarks_type (type)
) ENGINE=InnoDB;

-- ================================================================
-- 9. 공지사항 (Announcements)
-- ================================================================
CREATE TABLE IF NOT EXISTS announcements (
    announce_id   VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    title         VARCHAR(255) NOT NULL,
    content       TEXT         NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================================
-- 10. 1:1 문의 (Inquiries)
-- ================================================================
CREATE TABLE IF NOT EXISTS inquiries (
    inquiry_id    VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    user_id       VARCHAR(36)  NOT NULL,
    title         VARCHAR(255) NOT NULL,
    content       TEXT         NOT NULL,
    category      VARCHAR(50)  DEFAULT NULL,
    email         VARCHAR(255) DEFAULT NULL,
    status        ENUM('pending', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
    answer        TEXT         DEFAULT NULL,
    answered_at   DATETIME     DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_inquiries_user (user_id),
    INDEX idx_inquiries_status (status)
) ENGINE=InnoDB;
