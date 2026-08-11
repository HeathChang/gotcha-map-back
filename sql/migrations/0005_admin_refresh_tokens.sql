-- ================================================================
-- Migration 0005: 어드민 전용 refresh 토큰 테이블
--   refresh_tokens 는 users(user_id) FK 로 묶여있어 admin_users.admin_id 를 받지 못한다.
--   user/admin 세션 격리 + 무효화 정책 분리를 위해 별도 테이블을 둔다.
-- ================================================================

CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
    token_id    VARCHAR(36)  PRIMARY KEY,
    admin_id    VARCHAR(36)  NOT NULL,
    token_hash  CHAR(64)     NOT NULL COMMENT 'SHA-256(hex)',
    family_id   VARCHAR(36)  NOT NULL,
    parent_id   VARCHAR(36)  DEFAULT NULL,
    user_agent  VARCHAR(512) DEFAULT NULL,
    ip          VARCHAR(64)  DEFAULT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     DEFAULT NULL,
    revoked_at  DATETIME     DEFAULT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    UNIQUE KEY uk_admin_refresh_token_hash (token_hash),
    INDEX idx_admin_refresh_admin (admin_id),
    INDEX idx_admin_refresh_family (family_id),
    INDEX idx_admin_refresh_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
