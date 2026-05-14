-- 0007_seed_test_store_gangnam.sql
-- LocationScreen 동작 확인용 — 강남역 100m 반경에 가상 매장 한 곳 추가.
-- 기존 0006 시드의 강남역 매장(37.4979, 127.0276)과는 약 80m 떨어진 위치로 두어,
-- "내 위치 = 강남역" 으로 잡힐 때 매장이 2개 이상 표시되는지 검증할 수 있게 한다.

INSERT INTO stores (store_id, name, address, lat, lon, phone, description, image_url, opening_hours, rating)
VALUES (
    '22222222-2222-2222-2222-000000000001',
    '테스트 가챠샵 강남 본점',
    '서울특별시 강남구 테헤란로 124',
    37.4985000,
    127.0282000,
    '02-555-9999',
    '개발 테스트용 가상 매장 (강남역 근처)',
    NULL,
    '매일 10:00 - 22:00',
    4.8
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    address = VALUES(address),
    lat = VALUES(lat),
    lon = VALUES(lon),
    phone = VALUES(phone),
    description = VALUES(description),
    opening_hours = VALUES(opening_hours),
    rating = VALUES(rating);
