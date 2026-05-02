-- ================================================================
-- Migration 0003: Refresh 토큰 (auth.md - 1회용 + Rotation + 재사용 감지)
-- ================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id    VARCHAR(36)  PRIMARY KEY,
    user_id     VARCHAR(36)  NOT NULL,
    token_hash  CHAR(64)     NOT NULL COMMENT 'SHA-256(hex) of refresh token',
    /* 같은 디바이스의 토큰 체인을 묶는 식별자. 재사용 감지 시 체인 전체 무효화. */
    family_id   VARCHAR(36)  NOT NULL,
    parent_id   VARCHAR(36)  DEFAULT NULL COMMENT '직전 토큰(rotation 추적)',
    user_agent  VARCHAR(512) DEFAULT NULL,
    ip          VARCHAR(64)  DEFAULT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     DEFAULT NULL COMMENT '회전(또는 철회)된 시각',
    revoked_at  DATETIME     DEFAULT NULL COMMENT '강제 철회된 시각',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_refresh_token_hash (token_hash),
    INDEX idx_refresh_user (user_id),
    INDEX idx_refresh_family (family_id),
    INDEX idx_refresh_expires (expires_at)
) ENGINE=InnoDB;
