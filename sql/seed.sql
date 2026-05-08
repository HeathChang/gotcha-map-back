-- ================================================================
-- GachaMap Seed Data
-- 개발/테스트용 샘플 데이터. 운영 DB에는 절대 적용 금지.
-- 모든 INSERT는 INSERT IGNORE로 idempotent 보장.
-- ================================================================

USE gachamap;

-- ================================================================
-- 1. Tags (카테고리/테마)
-- ================================================================
INSERT IGNORE INTO tags (tag_id, name, relation_type) VALUES
    ('tag-001', '산리오', 'CATEGORY'),
    ('tag-002', '짱구는 못말려', 'CATEGORY'),
    ('tag-003', '포켓몬', 'CATEGORY'),
    ('tag-004', '디즈니', 'CATEGORY'),
    ('tag-005', '캐릭터', 'THEME'),
    ('tag-006', '여성 인기', 'THEME'),
    ('tag-007', '신상', 'THEME'),
    ('tag-008', '한정판', 'THEME'),
    ('tag-009', '키링', 'CATEGORY'),
    ('tag-010', '피규어', 'CATEGORY');

-- ================================================================
-- 2. Products (가챠 상품 12종)
-- ================================================================
INSERT IGNORE INTO products
    (product_id, product_name, product_manufacturer, product_info, category, min_price, max_price, image_url, view_count, is_new, is_popular, gender_target)
VALUES
    ('prod-001', '산리오 친구들 마스코트 컬렉션', 'Sanrio', '산리오 인기 캐릭터들의 미니 마스코트. 헬로키티, 마이멜로디, 시나모롤 등 8종.', '캐릭터', 7000, 9000, '/uploads/sample/001-sanrio-characters.jpeg', 1532, FALSE, TRUE,  'F'),
    ('prod-002', '짱구는 못말려 - 마치보우케 시리즈', 'Bandai', '동네 친구들과 길거리에서 노는 짱구 미니피규어. 6종 랜덤.', '피규어', 8000, 9500, '/uploads/sample/002-shinchan-machibouke.jpeg', 942,  TRUE,  TRUE,  'ALL'),
    ('prod-003', '짱구는 못말려 - 캠핑 피규어', 'Bandai', '캠핑가는 짱구와 액션가면 컬렉션. 5종.', '피규어', 7500, 9000, '/uploads/sample/003-shinchan-camping.jpeg', 651,  TRUE,  FALSE, 'ALL'),
    ('prod-004', '짱구는 못말려 - 거실 미니어처', 'Bandai', '노하라 가족 거실을 재현한 미니어처 디오라마. 1종.', '피규어', 9000, 11000, '/uploads/sample/004-shinchan-livingroom.jpeg', 318,  FALSE, FALSE, 'ALL'),
    ('prod-005', '짱구는 못말려 - 잠옷 컬렉션', 'Bandai', '잠옷 차림 짱구 가족. 4종 랜덤.', '피규어', 6500, 8500, '/uploads/sample/005-shinchan-oyasumika.jpeg', 1102, FALSE, TRUE,  'F'),
    ('prod-006', '짱구 x 산리오 콜라보', 'Sanrio x Bandai', '짱구와 산리오 캐릭터의 한정 콜라보. 8종.', '한정판', 9500, 12000, '/uploads/sample/006-shinchan-sanrio.jpeg', 2104, TRUE,  TRUE,  'F'),
    ('prod-007', '짱구는 못말려 - 응원단', 'Bandai', '응원단 코스튬 짱구와 친구들. 5종.', '피규어', 7000, 8500, '/uploads/sample/007-shinchan-ungdung.jpeg', 478,  FALSE, FALSE, 'M'),
    ('prod-008', '짱구는 못말려 - 책 미니어처', 'Bandai', '명작 동화 표지 미니북 컬렉션. 7종.', '피규어', 6000, 7500, '/uploads/sample/008-shinchan-books.jpeg', 289,  FALSE, FALSE, 'ALL'),
    ('prod-009', '짱구는 못말려 - 반지 컬렉션', 'Bandai', '액션가면, 부리부리 등 반지 6종.', '키링', 5500, 7000, '/uploads/sample/009-shinchan-ring.jpeg', 845,  FALSE, TRUE,  'F'),
    ('prod-010', '시나모롤 키링 한정판', 'Sanrio', '시나모롤 미니 키링. 봄 시즌 한정 4종.', '키링', 6000, 7500, '/uploads/sample/001-sanrio-characters.jpeg', 1854, TRUE,  TRUE,  'F'),
    ('prod-011', '마이멜로디 봉제 인형', 'Sanrio', '마이멜로디 손바닥 사이즈 봉제 인형. 3종.', '캐릭터', 8000, 10000, '/uploads/sample/001-sanrio-characters.jpeg', 723,  FALSE, FALSE, 'F'),
    ('prod-012', '포켓몬 - 이상해씨 컬렉션', 'Pokemon', '1세대 포켓몬 이상해씨 진화체 시리즈 3종.', '피규어', 9000, 11500, '/uploads/sample/002-shinchan-machibouke.jpeg', 1267, TRUE,  TRUE,  'M');

-- ================================================================
-- 3. Product Tags (상품-태그 매핑)
-- ================================================================
INSERT IGNORE INTO product_tags (id, product_id, tag_id) VALUES
    ('pt-001', 'prod-001', 'tag-001'), ('pt-002', 'prod-001', 'tag-005'), ('pt-003', 'prod-001', 'tag-006'),
    ('pt-004', 'prod-002', 'tag-002'), ('pt-005', 'prod-002', 'tag-010'), ('pt-006', 'prod-002', 'tag-007'),
    ('pt-007', 'prod-003', 'tag-002'), ('pt-008', 'prod-003', 'tag-010'),
    ('pt-009', 'prod-004', 'tag-002'), ('pt-010', 'prod-004', 'tag-010'),
    ('pt-011', 'prod-005', 'tag-002'), ('pt-012', 'prod-005', 'tag-006'),
    ('pt-013', 'prod-006', 'tag-001'), ('pt-014', 'prod-006', 'tag-002'), ('pt-015', 'prod-006', 'tag-008'),
    ('pt-016', 'prod-007', 'tag-002'),
    ('pt-017', 'prod-008', 'tag-002'),
    ('pt-018', 'prod-009', 'tag-002'), ('pt-019', 'prod-009', 'tag-009'),
    ('pt-020', 'prod-010', 'tag-001'), ('pt-021', 'prod-010', 'tag-009'), ('pt-022', 'prod-010', 'tag-007'),
    ('pt-023', 'prod-011', 'tag-001'), ('pt-024', 'prod-011', 'tag-005'),
    ('pt-025', 'prod-012', 'tag-003'), ('pt-026', 'prod-012', 'tag-010'), ('pt-027', 'prod-012', 'tag-007');

-- ================================================================
-- 4. Stores (서울/수도권 매장 8곳)
-- ================================================================
INSERT IGNORE INTO stores
    (store_id, name, address, lat, lon, phone, description, image_url, opening_hours, rating)
VALUES
    ('store-001', '우주가챠점',     '서울특별시 서초구 남부순환로 2477',    37.4837500, 127.0324600, '02-1234-5678', '서초역 인근. 산리오·짱구 시리즈 강세.',     '/uploads/sample/sample-store-image.png',   '11:00 - 22:00', 4.5),
    ('store-002', '수원갓챠',       '경기도 수원시 팔달구 인계로 178',      37.2802100, 127.0167800, '031-1234-5678','수원역 도보 5분. 한정판 입고 빠름.',         '/uploads/sample/sample-store-image-2.png', '10:00 - 23:00', 4.2),
    ('store-003', '강남갓챠샵',     '서울특별시 강남구 봉은사로2길 13 지하1층', 37.5111000, 127.0593000, '02-2345-6789', '강남역 11번 출구. 다양한 캐릭터 가챠 보유.', '/uploads/sample/sample-store-image.png',   '10:00 - 24:00', 4.7),
    ('store-004', '서초 가챠랜드',  '서울특별시 서초구 서초대로77길 54',    37.4943000, 127.0240000, '02-3456-7890', '교대역 인근. 신상 시리즈 빠른 입고.',         '/uploads/sample/sample-store-image-2.png', '11:00 - 22:00', 4.0),
    ('store-005', '역삼동 가챠월드','서울특별시 강남구 역삼동 123-45',      37.5005000, 127.0364000, '02-4567-8901', '20년 전통의 가챠샵. 한정판 다수.',           '/uploads/sample/sample-store-image.png',   '12:00 - 23:00', 4.6),
    ('store-006', '홍대 토이스토어','서울특별시 마포구 홍익로 94',          37.5563000, 126.9236000, '02-5678-9012', '홍대입구역 5번출구 앞. 피규어 전문.',         '/uploads/sample/sample-store-image-2.png', '12:00 - 24:00', 4.3),
    ('store-007', '잠실 가챠플러스','서울특별시 송파구 잠실동 40-1',        37.5132000, 127.1000000, '02-6789-0123', '롯데월드타워 인근. 가족 단위 인기.',         '/uploads/sample/sample-store-image.png',   '10:00 - 22:00', 4.4),
    ('store-008', '건대 피규어샵',  '서울특별시 광진구 능동로 120',         37.5408000, 127.0700000, '02-7890-1234', '건대입구역 2번출구. 학생 친화적.',           '/uploads/sample/sample-store-image-2.png', '11:00 - 23:00', 4.1);

-- ================================================================
-- 5. Store Products (매장별 상품 가격 — 가격 비교 핵심)
-- ================================================================
-- 각 상품이 평균 3~5개 매장에 분포하도록 구성.
INSERT IGNORE INTO store_products (id, store_id, product_id, price, stock) VALUES
    -- prod-001 (산리오 친구들)
    ('sp-001', 'store-001', 'prod-001', 8500, 12),
    ('sp-002', 'store-003', 'prod-001', 9000, 8),
    ('sp-003', 'store-005', 'prod-001', 8800, 15),
    ('sp-004', 'store-006', 'prod-001', 9200, 5),
    -- prod-002 (짱구 마치보우케)
    ('sp-005', 'store-001', 'prod-002', 8800, 10),
    ('sp-006', 'store-002', 'prod-002', 9000, 20),
    ('sp-007', 'store-004', 'prod-002', 9200, 7),
    ('sp-008', 'store-007', 'prod-002', 8500, 18),
    -- prod-003 (캠핑)
    ('sp-009', 'store-003', 'prod-003', 8000, 6),
    ('sp-010', 'store-005', 'prod-003', 7800, 11),
    ('sp-011', 'store-008', 'prod-003', 8500, 4),
    -- prod-004 (거실)
    ('sp-012', 'store-001', 'prod-004', 10500, 3),
    ('sp-013', 'store-003', 'prod-004', 11000, 2),
    ('sp-014', 'store-006', 'prod-004', 9500, 5),
    -- prod-005 (잠옷)
    ('sp-015', 'store-002', 'prod-005', 7000, 14),
    ('sp-016', 'store-004', 'prod-005', 7500, 8),
    ('sp-017', 'store-007', 'prod-005', 6800, 22),
    ('sp-018', 'store-008', 'prod-005', 7200, 10),
    -- prod-006 (콜라보 한정)
    ('sp-019', 'store-001', 'prod-006', 11000, 6),
    ('sp-020', 'store-003', 'prod-006', 11500, 4),
    ('sp-021', 'store-005', 'prod-006', 10500, 9),
    -- prod-007 (응원단)
    ('sp-022', 'store-002', 'prod-007', 7800, 11),
    ('sp-023', 'store-006', 'prod-007', 8200, 6),
    ('sp-024', 'store-008', 'prod-007', 7500, 15),
    -- prod-008 (책 미니어처)
    ('sp-025', 'store-001', 'prod-008', 7000, 9),
    ('sp-026', 'store-004', 'prod-008', 6800, 13),
    ('sp-027', 'store-007', 'prod-008', 7200, 7),
    -- prod-009 (반지)
    ('sp-028', 'store-002', 'prod-009', 6500, 25),
    ('sp-029', 'store-005', 'prod-009', 6200, 18),
    ('sp-030', 'store-006', 'prod-009', 6800, 12),
    ('sp-031', 'store-008', 'prod-009', 6000, 30),
    -- prod-010 (시나모롤 키링)
    ('sp-032', 'store-001', 'prod-010', 7000, 16),
    ('sp-033', 'store-003', 'prod-010', 7200, 11),
    ('sp-034', 'store-007', 'prod-010', 6800, 20),
    -- prod-011 (마이멜로디)
    ('sp-035', 'store-001', 'prod-011', 9000, 5),
    ('sp-036', 'store-005', 'prod-011', 9500, 8),
    ('sp-037', 'store-006', 'prod-011', 8800, 6),
    -- prod-012 (포켓몬 이상해씨)
    ('sp-038', 'store-003', 'prod-012', 10500, 4),
    ('sp-039', 'store-004', 'prod-012', 11000, 7),
    ('sp-040', 'store-008', 'prod-012', 10000, 12);

-- ================================================================
-- 6. Product Images (상세 이미지 — 메인 외 추가 이미지)
-- ================================================================
INSERT IGNORE INTO product_images (id, product_id, image_url, sort_order) VALUES
    ('img-001', 'prod-001', '/uploads/sample/001-sanrio-characters.jpeg', 0),
    ('img-002', 'prod-002', '/uploads/sample/002-shinchan-machibouke.jpeg', 0),
    ('img-003', 'prod-003', '/uploads/sample/003-shinchan-camping.jpeg', 0),
    ('img-004', 'prod-004', '/uploads/sample/004-shinchan-livingroom.jpeg', 0),
    ('img-005', 'prod-005', '/uploads/sample/005-shinchan-oyasumika.jpeg', 0),
    ('img-006', 'prod-006', '/uploads/sample/006-shinchan-sanrio.jpeg', 0),
    ('img-007', 'prod-007', '/uploads/sample/007-shinchan-ungdung.jpeg', 0),
    ('img-008', 'prod-008', '/uploads/sample/008-shinchan-books.jpeg', 0),
    ('img-009', 'prod-009', '/uploads/sample/009-shinchan-ring.jpeg', 0);

-- ================================================================
-- 7. Test User
-- ================================================================
-- email: test@gachamap.com / password: Test1234! (bcrypt 12 rounds, sample hash)
-- 실제 사용 전 바드시 비밀번호 재설정 권장.
INSERT IGNORE INTO users (user_id, email, password, nickname, gender, user_status, user_flag) VALUES
    ('user-test-001', 'test@gachamap.com', '$2b$12$Q5j1m7kF9DxR3vH5pY8eYuJ3K4LhB6VnP2wA8sT0eX1cD9fGmLqGS', '테스트유저', 'F', 1, 0);

-- ================================================================
-- 8. Sample Bookmarks (테스트 유저 기준)
-- ================================================================
INSERT IGNORE INTO bookmarks (bookmark_id, user_id, target_id, type) VALUES
    ('bm-001', 'user-test-001', 'store-001', 'store'),
    ('bm-002', 'user-test-001', 'store-003', 'store'),
    ('bm-003', 'user-test-001', 'prod-001',  'product'),
    ('bm-004', 'user-test-001', 'prod-006',  'product'),
    ('bm-005', 'user-test-001', 'prod-010',  'product');

-- ================================================================
-- 9. Announcements (공지사항)
-- ================================================================
INSERT IGNORE INTO announcements (announce_id, title, content, is_active) VALUES
    ('ann-001', 'GachaMap 정식 오픈 안내',
     'GachaMap 서비스가 정식 오픈되었습니다. 가까운 가챠샵을 한눈에 찾아보세요.',
     TRUE),
    ('ann-002', '2026년 봄 한정판 입고 안내',
     '시나모롤 봄 시즌 한정 키링이 일부 매장에 입고되었습니다.',
     TRUE),
    ('ann-003', '위치 기반 서비스 이용 안내',
     '주변 매장 검색을 위해 위치 권한 허용이 필요합니다.',
     TRUE),
    ('ann-004', '서비스 점검 안내 (완료)',
     '안정적인 서비스 제공을 위한 정기 점검이 완료되었습니다.',
     FALSE);
