---
title: 인증/인가
stack: backend
category: 인증/인가
extends: [base.md, backend.md]
---

# Auth (인증 / 인가)

> `base.md`, `backend.md`를 상속한다. 인증·인가 설계 규칙이다.

## 인증 방식

| 방식 | 용도 |
|------|------|
| 세션 쿠키 | BFF / 같은 도메인 웹 |
| JWT (short-lived) + Refresh | 분리된 클라이언트, 모바일 |
| OAuth 2.0 / OIDC | 외부 ID 위임 |
| API Key | 서버 대 서버 |

- 토큰은 **httpOnly + Secure + SameSite=Lax/Strict** 쿠키 우선.
- Access token TTL은 **짧게** (5~15분), Refresh는 **Rotation** 적용.

## 인가 모델

- **RBAC**: 역할(admin, editor) 기반 — 조직 단순할 때.
- **ABAC**: 속성(소유자, 부서) 기반 — 세밀한 정책 필요할 때.
- 정책은 **서버에서 중앙집중 평가** (`authorize(user, action, resource)`).

## 토큰 보안

- 서명은 **RS256/EdDSA** 우선 (대칭키 HS256는 키 공유 리스크).
- Refresh token은 **1회용**, 사용 즉시 rotation + 재사용 감지.
- 로그아웃 무효화 전략:
  - Access는 **짧은 TTL**로 자연 소멸.
  - Refresh는 **서버 blacklist / allow-list**로 즉시 무효화.

## 보안 헤더

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`

## AI 행동 규칙

- 권한 체크는 **항상 서버에서** — 클라이언트 단독 의존 금지.
- 민감 작업은 **재인증** 요구 (비밀번호 변경 등).
- 인증 실패 메시지는 **통합**한다 (`이메일 없음` vs `비밀번호 틀림` 구분 노출 금지).

## 패턴 (DO / DON'T)

### 비밀번호 해시

```ts
// DON'T — 약한 해시, 솔트 없음
const hash = crypto.createHash('sha1').update(password).digest('hex');

// DO — Argon2id (또는 bcrypt cost≥12)
import { hash } from '@node-rs/argon2';
const hashed = await hash(password, { memoryCost: 19456, timeCost: 2 });
```

### 인증 실패 메시지

```ts
// DON'T — 계정 존재 여부 누설
if (!user) throw new Error('이메일이 존재하지 않습니다');
if (!valid) throw new Error('비밀번호가 틀렸습니다');

// DO — 통합 메시지
if (!user || !valid) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다');
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 토큰을 URL 쿼리스트링에 포함 | Authorization 헤더 / httpOnly 쿠키 |
| 평문 비밀번호 / MD5 / SHA1 | Argon2id / bcrypt |
| 관리자 체크를 프론트 단독 | 서버 정책 평가 (`authorize()`) |
| 장기 Access Token | 짧은 TTL + Refresh Rotation |
