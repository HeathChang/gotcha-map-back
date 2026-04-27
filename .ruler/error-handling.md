---
title: 에러 핸들링
stack: backend
category: 안정성
extends: [base.md, backend.md]
---

# Error Handling & Resilience

> `base.md`, `backend.md`를 상속한다. 에러 분류, 예외 처리, 복원력 규칙이다.

## 에러 분류

| 분류 | 예시 | 처리 |
|------|------|------|
| 클라이언트 오류 | 검증 실패, 권한 없음 | 4xx + 명확한 메시지 |
| 비즈니스 규칙 | 잔액 부족, 중복 | 4xx (주로 409/422) + code |
| 외부 의존 오류 | DB 단절, API timeout | 재시도 + 서킷 브레이커 |
| 시스템 오류 | OOM, 예상 불가 | 5xx + 알림 |

- 에러 타입별 **명시적 클래스/태그**로 분류 — 문자열 비교 금지.

## 글로벌 예외 처리

- 프레임워크의 **글로벌 예외 핸들러**에서 상태 코드 매핑.
- 스택트레이스는 **서버 로그**에만 — 응답에 포함 금지.
- 미분류 예외는 기본 500으로 매핑하되, 알림 발생.

## 응답 포맷

```json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "잔액이 부족합니다",
  "details": [{"required": 10000, "current": 5000}]
}
```

## 재시도 / 복원력

- **지수 백오프 + 지터**로 재시도 (1s, 2s, 4s + random).
- **최대 재시도 횟수**를 제한.
- 재시도 가능 여부는 **에러 타입**으로 판단 (타임아웃·5xx → 재시도, 4xx → 중단).

## 서킷 브레이커

- 외부 의존 호출은 서킷 브레이커 패턴 적용.
- 실패율 임계치 초과 시 **빠른 실패** + 대체 경로.
- 상태 변화(Open/Half-Open/Closed)를 메트릭으로 노출.

## Idempotency

- 생성/결제 등 재시도 가능성 있는 요청은 **Idempotency Key** 헤더 지원.
- 동일 키로 재요청 시 이전 결과 반환.

## AI 행동 규칙

- 외부 호출 추가 시 **타임아웃·재시도·서킷브레이커** 점검.
- catch 블록에서 삼키지 말고 **재분류 또는 rethrow**.
- 사용자 노출 메시지는 기술 용어 제거.

## 패턴 (DO / DON'T)

### 예외 분류

```ts
// DON'T — 모든 예외 삼킴
try { ... } catch (e) { return null; }

// DO — 분류 + 로깅 + 재분류
try { ... } catch (e) {
  if (e instanceof ValidationError) throw e;          // 4xx 로 전파
  if (isTransient(e)) throw new RetryableError(e);    // 재시도 대상
  logger.error({ err: e }, 'unexpected');
  throw new InternalError('internal error', { cause: e });
}
```

### 재시도

```ts
// DON'T — 무한 재시도
while (true) { try { return call(); } catch { /* retry */ } }

// DO — 지수 백오프 + 지터 + 횟수 제한
for (let i = 0; i < 4; i++) {
  try { return await call(); }
  catch (e) {
    if (!isRetryable(e) || i === 3) throw e;
    await sleep(2 ** i * 1000 + Math.random() * 200);
  }
}
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 클라이언트에 스택트레이스 노출 | 서버 로그에만 |
| 4xx/5xx 무분별 재시도 | 재시도 가능 타입만 |
| Idempotency Key 없이 결제 재요청 허용 | 헤더 기반 중복 방지 |
