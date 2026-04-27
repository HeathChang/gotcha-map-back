---
title: 로깅
stack: backend
category: 운영
extends: [base.md, backend.md]
---

# Logging & Observability

> `base.md`, `backend.md`를 상속한다. 로깅·추적·모니터링 규칙이다.

## 로그 레벨

| 레벨 | 용도 |
|------|------|
| ERROR | 복구 불가, 알림 대상 |
| WARN | 정상 동작이나 주의 필요 |
| INFO | 중요한 비즈니스 이벤트 |
| DEBUG | 개발·디버깅 (프로덕션 off) |
| TRACE | 세부 추적 (개발만) |

- 프로덕션 기본은 **INFO**.

## 구조화된 로깅

- **JSON 포맷**으로 출력 — 후처리(검색·집계) 용이.
- 최소 필드: `timestamp`, `level`, `service`, `traceId`, `message`.
- 추가 컨텍스트는 평탄한 key-value로 (중첩 최소화).

```json
{"level":"INFO","service":"order","traceId":"abc","userId":42,"action":"create","orderId":"ord_01"}
```

## 추적 (Tracing)

- 요청 진입 시 **Trace ID** 발급, 하위 호출/로그에 전파.
- 외부 호출은 span으로 감싸 지연 측정.
- OpenTelemetry 표준 준수.

## 민감 정보 마스킹

- PII(이메일, 전화, 주민번호)·시크릿은 **마스킹 또는 제외**.
- 공통 로그 필터에서 자동 마스킹 (개별 코드 의존 금지).

## 모니터링 연동

- 에러 로그는 Sentry/Datadog 등으로 **알림**.
- SLO 지표(응답시간, 에러율)를 메트릭으로 노출.
- 비즈니스 이벤트는 로그 + 메트릭 이중화.

## AI 행동 규칙

- 새 로그 추가 시 **레벨 선택 근거**를 고려 (ERROR 남용 금지).
- PII를 로그에 포함하는 코드는 경고.
- catch 블록의 로그는 **trace 포함** (스택트레이스).

## 패턴 (DO / DON'T)

### PII 마스킹

```ts
// DON'T — 평문 PII·시크릿 로깅
logger.info('login', { email: user.email, password: req.body.password });

// DO — 마스킹 + 식별자만
logger.info('login', { userId: user.id, emailMasked: mask(user.email) });
```

### 에러 로깅

```ts
// DON'T — 반복 이벤트를 ERROR로
catch (e) { logger.error('user retry'); }

// DO — 레벨 구분 + 스택트레이스
catch (e) {
  if (isRetryable(e)) logger.warn({ err: e, attempt }, 'retrying');
  else logger.error({ err: e }, 'unexpected failure');
}
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| `System.out.println` / `fmt.Println` / `console.log` | 구조화 logger (pino, zap, Logback) |
| 평문 비밀번호/토큰 로깅 | 필터·스키마 기반 마스킹 |
| 중첩된 복잡 JSON 로그 | 평탄한 key-value |
| traceId 전파 누락 | 미들웨어/인터셉터에서 자동 전파 |
