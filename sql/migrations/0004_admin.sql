-- ================================================================
-- Migration 0004: 어드민(백오피스) — admin_users, audit_logs, inquiries.answered_by_admin_id
-- 관련 비전 (gachamap-admin/.ruler/vision.md §4 v1 In Scope, §6, §7 보안)
-- ================================================================

CREATE TABLE IF NOT EXISTS admin_users (
    admin_id     VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    email        VARCHAR(255) NOT NULL,
    password     VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
    name         VARCHAR(50)  NOT NULL,
    role         ENUM('super_admin', 'content_manager', 'support_staff') NOT NULL,
    admin_status TINYINT      NOT NULL DEFAULT 1 COMMENT '1=활성, 0=비활성',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_admin_users_email (email),
    INDEX idx_admin_users_status (admin_status)
) ENGINE=InnoDB;

-- 어드민 쓰기 작업 감사 로그 (vision §3 성공기준: mutation 100% 기록)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    audit_id     VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    admin_id     VARCHAR(36)  NOT NULL,
    action       VARCHAR(64)  NOT NULL COMMENT '예: inquiry.answer',
    target_type  VARCHAR(32)  NOT NULL COMMENT '예: inquiry, product, store',
    target_id    VARCHAR(36)  NOT NULL,
    diff         JSON         DEFAULT NULL COMMENT '{ before: {...}, after: {...} }',
    ip           VARCHAR(64)  DEFAULT NULL,
    user_agent   VARCHAR(512) DEFAULT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE RESTRICT,
    INDEX idx_audit_admin (admin_id),
    INDEX idx_audit_target (target_type, target_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- 문의 답변자 추적: inquiries 에 admin FK 추가
ALTER TABLE inquiries
    ADD COLUMN answered_by_admin_id VARCHAR(36) DEFAULT NULL AFTER answered_at;

ALTER TABLE inquiries
    ADD CONSTRAINT fk_inquiries_admin
    FOREIGN KEY (answered_by_admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL;

ALTER TABLE inquiries
    ADD INDEX idx_inquiries_admin (answered_by_admin_id);
