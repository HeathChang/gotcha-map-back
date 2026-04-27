---
title: Git 워크플로우
stack: backend
category: 워크플로우
extends: [base.md]
---

# Git & PR Workflow

> `base.md`를 상속한다. 브랜치 전략, 커밋 메시지, PR 프로세스 규칙이다.

## 브랜치 전략

| 브랜치 | 용도 | 머지 대상 |
|--------|------|-----------|
| `main` | 프로덕션 배포 | — |
| `develop` | 개발 통합 | `main` |
| `feature/*` | 기능 개발 | `develop` |
| `fix/*` | 버그 수정 | `develop` |
| `hotfix/*` | 긴급 수정 | `main` + `develop` |

- 브랜치명은 **소문자 kebab-case**.
- `main`, `develop`에 직접 push 금지 — 반드시 PR.

## 커밋 메시지 (Conventional Commits)

```
<type>: <subject>

[optional body]
```

| type | 용도 |
|------|------|
| feat | 새 기능 |
| fix | 버그 수정 |
| refactor | 리팩토링 |
| perf | 성능 개선 |
| test | 테스트 |
| docs | 문서 |
| chore | 빌드/설정/의존성 |

- subject **50자 이내**, 마침표 없이.
- body는 **왜(why)**.

## PR 규칙

- PR 하나는 **하나의 관심사**.
- PR 설명 필수: 변경 요약, 테스트 방법, 관련 티켓.
- DB 마이그레이션 포함 시 **롤백 계획 명시**.
- Breaking change는 라벨 + CHANGELOG 업데이트.

## 릴리스

- Semantic Versioning 준수 (MAJOR.MINOR.PATCH).
- 태그는 `v` 접두 (`v1.2.3`).
- 릴리스 노트에 호환성 영향 명시.

## AI 행동 규칙

- 커밋 메시지 작성 시 컨벤션을 따른다.
- PR 생성 시 변경 범위를 요약하고 DB 변경 여부를 표시.
- force push는 명시 요청 시에만.

## 패턴 (DO / DON'T)

### 마이그레이션 PR

```
# DON'T — 마이그레이션 + 코드 변경 + 롤백 계획 없음
feat: 사용자 프로필 확장
  - ALTER TABLE users ADD COLUMN bio
  - 프론트에서 bio 표시
  - 배포 중 롤백 불가

# DO — 단계 분리 + 롤백 계획
1) chore(db): users.bio 컬럼 추가 (기본값 NULL, 하위호환)
2) feat(api): bio 읽기/쓰기 엔드포인트
3) feat(web): 프로필에 bio 표시
롤백: 각 단계는 독립 revert 가능
```

### 커밋 메시지

```
# DON'T
wip
update

# DO
feat(order): 결제 실패 시 주문 자동 취소
fix(auth): 만료 Refresh 토큰 검증 오류 수정
```

### 기타 금지/권장

| DON'T | DO |
|-------|-----|
| 하나의 커밋에 여러 관심사 혼합 | 관심사별 분할 |
| PR 설명 없이 리뷰 요청 | 요약 + 테스트 방법 + 티켓 |
| 미검토 force push | 명시 요청 + 리뷰 |
