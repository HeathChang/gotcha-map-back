-- ================================================================
-- Migration 0010: 어드민 역할 재편 + member 매장 배정
--   super_admin → admin, content_manager/support_staff → staff, member 신규
--   admin_users.store_id (member ↔ store 1:1 배정. admin/staff 는 NULL)
-- 관련: gotcha-map-policy/README.md §0(결정), §2(역할), §A(구현 영향)
-- ================================================================

-- 1) enum 에 신규 값을 먼저 추가(기존 값과 공존) → 데이터 매핑 → 구 값 제거
ALTER TABLE admin_users
    MODIFY COLUMN role ENUM('super_admin','content_manager','support_staff','admin','staff','member') NOT NULL;

UPDATE admin_users SET role = 'admin' WHERE role = 'super_admin';

UPDATE admin_users SET role = 'staff' WHERE role IN ('content_manager','support_staff');

ALTER TABLE admin_users
    MODIFY COLUMN role ENUM('admin','staff','member') NOT NULL;

-- 2) member 담당 매장 — store 삭제 시 배정만 해제(계정은 유지)
ALTER TABLE admin_users
    ADD COLUMN store_id VARCHAR(36) DEFAULT NULL AFTER role;

ALTER TABLE admin_users
    ADD CONSTRAINT fk_admin_users_store FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE SET NULL;
