---
title: 보안
stack: backend
category: 보안
extends: [base.md, backend.md]
---

# Backend Security

> `base.md`, `backend.md`를 상속한다. 백엔드 보안 규칙 (OWASP Top 10 기반).

## 입력 검증

- **모든 외부 입력**은 서버에서 검증한다 (클라이언트 검증은 UX용).
- 스키마 검증(Zod, Joi, Pydantic, Bean Validation)을 레이어 경계에서 수행.
- 바이너리/파일 업로드는 **타입·크기·내용** 검증.

## SQL / Injection

- **Prepared statement / Parameter binding** 사용, 문자열 결합 금지.
- ORM이라도 raw query 작성 시 파라미터 바인딩 확인.
- 동적 테이블/컬럼명은 **허용 목록 기반 치환**.

## Rate Limiting

- 인증/민감 엔드포인트에 Rate Limit 필수.
- IP + 사용자 ID 조합으로 제한.
- 브루트포스 방어: 실패 N회 시 지수 백오프.

## CORS

- 명시적 origin 허용 목록 — 와일드카드(`*`) + 자격증명 동시 사용 금지.
- Preflight 캐시 시간을 적절히 설정.

## 시크릿 관리

- 시크릿은 **환경 변수** 또는 시크릿 매니저(AWS Secrets Manager, Vault)에서.
- 코드·로그·에러 스택에 시크릿 노출 금지.
- 로테이션 주기를 정책화.

## OWASP Top 10 체크

- Broken Access Control — 객체 레벨 권한 체크.
- Cryptographic Failures — 전송/저장 암호화.
- Injection — 스키마 검증 + prepared statement.
- Insecure Design — 위협 모델링.
- SSRF — 아웃바운드 요청 URL 검증.

## AI 행동 규칙

- 사용자 입력을 DB/파일시스템/HTTP에 직접 전달하는 코드를 보면 경고.
- 새 엔드포인트에 인증/인가/Rate Limit 누락이 있으면 지적.
- 로그에 PII/시크릿 포함 여부 검사.

## 패턴 (DO / DON'T)

### SQL Injection

```ts
// DON'T — 문자열 결합
const rows = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

// DO — parameter binding
const rows = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);
```

### 동적 컬럼/정렬

```ts
// DON'T — 입력을 그대로 ORDER BY에
db.query(`SELECT * FROM users ORDER BY ${req.query.sort}`);

// DO — 허용 목록 치환
const ALLOWED_SORT = { name: 'display_name', created: 'created_at' } as const;
const column = ALLOWED_SORT[req.query.sort] ?? 'id';
db.query(`SELECT id, display_name FROM users ORDER BY ${column}`);
```

### 객체 레벨 권한 (IDOR)

```ts
// DON'T — 인증만 하고 소유자 체크 없음
app.get('/orders/:id', auth, async (req, res) => {
  res.json(await orderRepo.findById(req.params.id));
});

// DO — 소유자·권한 검증
app.get('/orders/:id', auth, async (req, res) => {
  const order = await orderRepo.findById(req.params.id);
  authorize(req.user, 'order:read', order);
  res.json(toOrderResponse(order));
});
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 에러 메시지에 DB 스택트레이스 노출 | 코드(`INTERNAL_ERROR`)만 + 서버 로그 |
| 시크릿을 Git에 커밋 | 시크릿 매니저 + `.gitignore` + 스캐너 |
| CORS `*` + credentials | 명시적 origin 목록 |
| 인증 엔드포인트 Rate Limit 미적용 | IP+사용자ID 조합 제한 |
