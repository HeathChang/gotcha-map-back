---
title: 백엔드 공통
stack: backend
category: 공통
extends: [base.md]
---

# Backend Common Rules

> `base.md`를 상속한다. 백엔드 공통 아키텍처/설계 원칙이다.

## 레이어드 아키텍처

| 레이어 | 책임 | 금지 |
|--------|------|------|
| Controller / Handler | 입력 검증, 라우팅, 응답 포맷 | 비즈니스 로직 |
| Service / UseCase | 비즈니스 규칙, 트랜잭션 경계 | SQL 직접 작성 |
| Repository / DAO | 영속성 접근 | HTTP 응답 처리 |
| Domain / Entity | 도메인 규칙, 불변식 | 외부 의존 |

- 의존성은 **안쪽으로만** 흐른다 (Controller → Service → Repository).
- Domain은 프레임워크에 의존하지 않는다.

## DTO / Entity 분리

- 외부 노출은 **DTO**로만 — Entity 직접 노출 금지.
- DTO는 입력(Request) / 출력(Response)을 분리.
- Entity ↔ DTO 변환은 **전용 매퍼**에서 처리.

## 에러 처리 전략

- 도메인 예외(`BusinessError`)와 시스템 예외(`SystemError`)를 분리.
- 글로벌 예외 핸들러에서 HTTP 상태 코드로 매핑.
- 에러 응답 포맷을 **표준화** (code, message, details).

## 설정 관리

- 환경별 설정(`application-{env}.yml`) 분리.
- 시크릿은 **환경 변수** 또는 시크릿 매니저에서 주입.
- 기본값은 **안전한 쪽**으로 (권한 최소, 기능 비활성).

## AI 행동 규칙

- 새 기능은 **Domain → Service → Controller** 순서로 작성.
- 트랜잭션 경계를 Service에 명시.
- 외부 호출은 **타임아웃 + 재시도** 정책 포함.

## 패턴 (DO / DON'T)

### 레이어 경계

```ts
// DON'T — Controller가 Repository 직접 호출
@Get('/users/:id')
async find(@Param('id') id: string) {
  return this.userRepo.findById(id);   // 비즈니스 규칙·인가 우회
}

// DO — Service 경유
@Get('/users/:id')
async find(@Param('id') id: string) {
  return this.userService.findByIdForViewer(id, this.viewer);
}
```

### Entity vs DTO

```ts
// DON'T — 내부 필드(passwordHash 등) 그대로 노출
res.json(userEntity);

// DO — 전용 DTO 매핑
res.json(toUserResponse(userEntity));
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 설정값을 코드에 하드코딩 | 환경 변수 / 설정 파일 |
| Service 없이 Controller↔Repository | Service 레이어 경유 |
| 외부 호출에 타임아웃 누락 | 타임아웃 + 재시도 + 서킷브레이커 |
