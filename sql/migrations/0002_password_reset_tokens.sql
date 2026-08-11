-- ================================================================
-- Migration 0002: 비밀번호 재설정 토큰
-- auth.md: Refresh/Reset 토큰은 1회용 + rotation. 평문 저장 금지(해시).
-- ================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id    VARCHAR(36)  PRIMARY KEY,
    user_id     VARCHAR(36)  NOT NULL,
    token_hash  CHAR(64)     NOT NULL COMMENT 'SHA-256(hex) of one-time token',
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     DEFAULT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_password_reset_token_hash (token_hash),
    INDEX idx_password_reset_tokens_user (user_id),
    INDEX idx_password_reset_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
