---
title: 데이터베이스
stack: backend
category: 데이터
extends: [base.md, backend.md]
---

# Database

> `base.md`, `backend.md`를 상속한다. DB 설계·쿼리·마이그레이션 규칙이다.

## 설계 원칙

- 기본은 **3NF 정규화** — 성능 이슈 시 측정 후 역정규화.
- 외래 키 제약을 **명시적으로** 선언 (참조 무결성).
- 모든 테이블에 `created_at`, `updated_at` 포함.
- soft delete는 `deleted_at` + 필터링으로 처리.

## 인덱스

- **조회 패턴**에 기반해 인덱스를 설계한다 (EXPLAIN 확인).
- 고카디널리티 컬럼을 인덱스 앞쪽에.
- 복합 인덱스 설계 시 **ORDER BY**와 일치 여부 확인.
- 불필요한 인덱스는 쓰기 비용 — 사용되지 않으면 제거.

## 쿼리

- **N+1 방지**: eager loading / batch 조회 / DataLoader.
- `SELECT *` 금지 — 필요한 컬럼만.
- ORM 생성 쿼리를 **반드시 확인** (의도와 다른 JOIN 주의).
- 대량 조회는 **페이지네이션** 필수.

## 마이그레이션

- 마이그레이션은 **포워드만** — 롤백은 새 마이그레이션으로.
- Breaking change는 **2단계**: 추가(호환) → 전환 → 제거.
- 프로덕션 마이그레이션은 **lock 최소화** (online DDL, 무중단 절차).

## 트랜잭션

- Service 레이어에 트랜잭션 경계를 명시.
- 외부 API 호출은 **트랜잭션 밖**에서 (락 시간 최소화).
- 분산 트랜잭션은 Saga / Outbox 패턴 고려.

## AI 행동 규칙

- 새 쿼리 작성 시 EXPLAIN 계획을 확인 권고.
- 인덱스 추가 전 카디널리티와 조회 패턴 확인.

## 패턴 (DO / DON'T)

### N+1 방지

```ts
// DON'T — 주문별로 사용자 쿼리 N+1회
const orders = await orderRepo.findAll();
for (const order of orders) {
  order.user = await userRepo.findById(order.userId);
}

// DO — eager loading / JOIN / batch
const orders = await orderRepo.findAll({ include: { user: true } });
// 또는 DataLoader로 userId 배치
```

### SELECT 범위

```sql
-- DON'T
SELECT * FROM users WHERE id = ?;

-- DO — 필요한 컬럼만
SELECT id, email, display_name FROM users WHERE id = ?;
```

### 마이그레이션 2단계

```
-- DON'T — 컬럼명 in-place 변경 → 무중단 불가
ALTER TABLE users RENAME COLUMN name TO display_name;

-- DO — 추가 → 백필 → 코드 전환 → 제거 (4개 마이그레이션)
-- 1) ADD COLUMN display_name
-- 2) 백필 (UPDATE users SET display_name = name)
-- 3) 읽기·쓰기 코드 전환
-- 4) DROP COLUMN name
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 애플리케이션 레벨 JOIN | DB JOIN 또는 eager loading |
| WHERE 없는 큰 테이블 스캔 | 인덱스 + 조건 + 페이지네이션 |
| 프로덕션 `TRUNCATE` / `DROP` | 마이그레이션 + 리뷰 + 백업 |
| 외부 API 호출을 트랜잭션 내부에서 | 트랜잭션 밖, 필요 시 Outbox |
