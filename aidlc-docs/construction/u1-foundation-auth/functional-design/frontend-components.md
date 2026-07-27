# Frontend Components — U1 Foundation & Auth

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U1 Functional Design (C-5 항목 보완)

> **보완 문서입니다.** 이 문서는 U1 Functional Design 계획서의 C-5 항목이었으나 시간 제약으로
> 생성되지 않았습니다. 나머지 3개 문서(도메인 엔티티·비즈니스 규칙·로직 모델)는 구현 전에
> 작성되었지만, 이 문서는 **구현 후에 작성**되었습니다.

---

## 1. 컴포넌트 계층

```
app/layout.tsx                    루트 — globals.css, lang="ko"
├── app/login/page.tsx            "use client" · 미인증 진입점
└── app/(app)/layout.tsx          서버 컴포넌트 · 인증 게이트
    ├── nav-links.tsx             "use client" · 권한별 메뉴
    ├── notification-bell.tsx     "use client" · 알림 센터
    ├── logout-button.tsx         "use client"
    └── {각 화면}
```

**서버/클라이언트 경계 원칙**: 데이터 조회는 서버 컴포넌트가, 사용자 입력과 상태는 클라이언트
컴포넌트가 담당합니다. 서버 컴포넌트는 서비스 계층을 직접 호출하고, 클라이언트 컴포넌트는
API를 `fetch` 합니다.

> 이 분리가 실제로 문제를 만든 적이 있습니다. 서버 컴포넌트가 Prisma 결과를 직접 읽어
> 화면에는 정상 표시되는데 API 응답에서는 필드가 누락된 결함(직렬화 게이트의 배열 처리)이
> UI만 봐서는 드러나지 않았습니다.

---

## 2. `app/(app)/layout.tsx` — 인증 게이트

**역할**: 모든 보호 화면의 공통 껍데기이자 인증 판정 지점

**동작**
```
requireContext() 호출
  → AuthenticationError 발생 시 redirect("/login")
  → 성공 시 ctx로 레일·상단바를 구성하고 children 렌더
```

**상태 없음** (서버 컴포넌트)

**하위에 넘기는 값**

| 대상 | props |
|---|---|
| `NavLinks` | `canManageUsers`, `canGenerateReports` (둘 다 `canPerform` 결과) |
| `NotificationBell` | `initialUnread` (서버에서 미리 조회한 미확인 수) |

> `initialUnread`를 서버에서 넘기는 이유: 배지가 첫 페인트에 바로 보여야 합니다.
> 클라이언트에서 조회하면 숫자가 나중에 튀어나옵니다.

---

## 3. `app/login/page.tsx` — 로그인

**타입**: 클라이언트 컴포넌트

**상태**

| 이름 | 타입 | 용도 |
|---|---|---|
| `email` / `password` | `string` | 입력값 |
| `error` | `string \| null` | 서버가 준 실패 메시지 |
| `pending` | `boolean` | 제출 중 버튼 비활성 |

**API**: `POST /api/auth/login`

**흐름**
```
제출 → pending=true → fetch
  성공 → router.push("/dashboard") + router.refresh()
  실패 → error에 서버 메시지 표시 (클라이언트가 문구를 만들지 않는다)
```

> **오류 문구를 클라이언트에서 만들지 않는 것이 중요합니다.** "계정이 없습니다" 같은 문구를
> 상태코드로 추론해 표시하면 서버가 애써 감춘 계정 존재 여부가 화면에서 새어 나갑니다.
> 서버가 준 메시지를 그대로 보여줍니다 (BR-U1-002).

**데모 계정 버튼**: 클릭 시 이메일만 채웁니다. 비밀번호는 채우지 않습니다 — 로컬 PoC라도
비밀번호를 코드에 넣지 않는 습관을 유지하기 위함입니다.

---

## 4. `nav-links.tsx` — 권한별 메뉴

**타입**: 클라이언트 컴포넌트 (`usePathname` 필요)

**props**: `canManageUsers: boolean`, `canGenerateReports: boolean`

**동작**: 기본 3개(대시보드·파이프라인·작품 목록)에 권한이 있을 때만 리포트·사용자 관리를 추가.
현재 경로로 `aria-current="page"` 판정.

> **메뉴 숨김은 편의일 뿐입니다.** 실제 차단은 각 화면의 서버 컴포넌트와 API가 합니다.
> 메뉴가 안 보여도 URL을 직접 치면 화면에 도달하며, 거기서 권한 안내가 표시됩니다.

---

## 5. `notification-bell.tsx` — 알림 센터

**타입**: 클라이언트 컴포넌트

**상태**

| 이름 | 타입 | 용도 |
|---|---|---|
| `open` | `boolean` | 드롭다운 열림 |
| `items` | `Notification[]` | 목록 (열릴 때 조회) |
| `unread` | `number` | 배지 숫자 (초기값은 서버 props) |
| `scanMsg` | `string \| null` | 마감 스캔 결과 |

**API**

| 동작 | 엔드포인트 |
|---|---|
| 목록 조회 | `GET /api/notifications` (드롭다운 열 때) |
| 전체 읽음 | `POST /api/notifications` |
| 마감 스캔 | `POST /api/notifications/scan` |

**폴링하지 않습니다.** 드롭다운을 열 때만 조회합니다. 동시 사용자 10명 규모에서 주기적
폴링은 비용 대비 이득이 없습니다.

---

## 6. `users/page.tsx` + `user-table.tsx` — 사용자 관리

**서버 컴포넌트** (`page.tsx`)
- `listUsers(ctx)` 호출 → `ForbiddenError`를 잡아 권한 안내 화면으로 대체
- `executiveCount`를 계산해 클라이언트에 전달

**클라이언트 컴포넌트** (`user-table.tsx`)

| props | 용도 |
|---|---|
| `users` | 표시할 목록 |
| `executiveCount` | 마지막 경영진 판정 |
| `currentUserId` | 본인 행에 "나" 배지 |

**상태**: `message`(결과 안내), `pending`(중복 클릭 방지)

**API**: `PATCH /api/users/{id}` (역할 변경), `DELETE /api/users/{id}`

**마지막 경영진 보호의 이중 표현**

| 층위 | 방식 |
|---|---|
| 화면 | Executive가 1명이면 그 행의 버튼을 `disabled` |
| 서버 | 트랜잭션 안에서 재확인 후 `409 LAST_EXECUTIVE` |

> 화면에 *"버튼 비활성화는 편의일 뿐이며 실제 차단은 서버 트랜잭션 안에서 이뤄집니다"* 라고
> 명시했습니다. 사용자가 왜 막히는지 추측하지 않게 하기 위함입니다.

---

## 7. 폼 검증 표시 규약

전 화면 공통입니다.

```
서버 400 응답
{ "error": { "code": "VALIDATION_FAILED",
             "fields": [ { "path": "titleKo", "message": "제목을 입력해주세요." } ] } }
        ↓
issues 상태에 저장 → issueFor(path)로 해당 입력 아래에 빨간 문구 표시
```

**클라이언트에서 검증 규칙을 복제하지 않습니다.** `required` 같은 브라우저 기본 속성은 쓰되,
범위·형식·날짜 순서 판정은 서버가 단독으로 합니다. 규칙이 두 곳에 있으면 반드시 어긋납니다.

---

## 8. 화면 ↔ API 매핑 (U1)

| 화면 | API |
|---|---|
| `/login` | `POST /api/auth/login` |
| 로그아웃 버튼 | `POST /api/auth/logout` |
| `/users` | `GET /api/users`, `POST /api/users`, `PATCH·DELETE /api/users/{id}` |
| 알림 벨 | `GET·POST /api/notifications`, `POST /api/notifications/scan` |

---

## 9. 스타일 규약

`globals.css`에 CSS 커스텀 프로퍼티로 토큰을 정의하고 라이트·다크 두 벌을 둡니다.

| 토큰군 | 용도 |
|---|---|
| `--ground` `--surface` `--ink` `--muted` `--faint` | 중성색 (플럼 편향 회색) |
| `--line` | **장식용** 구분선 (카드 경계) |
| `--line-strong` | **입력 요소** 테두리 — 3:1 충족 |
| `--accent` | 강조 (극장 커튼 플럼) |
| `--good` `--warn` `--crit` | 의미색 |

**의미색을 액센트와 색상환에서 떼어놓았습니다.** 마감 임박·만료·손실이 액센트와 섞이면
"강조"인지 "경고"인지 구분되지 않습니다.

숫자는 전역 `font-variant-numeric: tabular-nums` — 금액이 세로로 정렬되어야 비교가 됩니다.

### 9.1 명도 대비 (NFR-009, 2026-07-26 검증)

`tests/unit/contrast.test.ts`가 **`globals.css`를 직접 파싱해** 라이트·다크 두 테마의
17개 색 조합을 검사합니다. 팔레트 값을 테스트에 복제하면 소스가 바뀔 때 테스트는 옛 값을
검사하며 통과해, 아무것도 지키지 못하는 테스트가 됩니다.

**최초 측정에서 4개 조합이 기준 미달이었고 팔레트를 조정했습니다.**

| 토큰 | 변경 전 | 변경 후 | 대비 |
|---|---|---|---|
| 라이트 `--faint` | `#9C8E9C` (3.10) | `#7e707e` | **4.66** |
| 라이트 `--good` | `#2E7D5B` (4.29) | `#297856` | **4.60** |
| 라이트 `--warn` | `#B26B08` (3.66) | `#a15a00` | **4.61** |
| 다크 `--faint` | `#7A6C7A` (3.53) | `#8d7f8d` | **4.61** |

**대가**: `--faint`가 `--muted`에 가까워져 시각적 위계가 좁아졌습니다. 접근성을 위해
감수한 것입니다.

### 9.2 `--line`과 `--line-strong`을 나눈 이유

WCAG 1.4.11은 **"컴포넌트를 식별하는 데 필요한"** 시각 정보에 3:1을 요구합니다.

| 대상 | 판단 | 토큰 |
|---|---|---|
| 카드 테두리 | **장식** — 카드는 내용과 여백으로 식별되며 테두리 없이도 인지된다 | `--line` (1.33:1) |
| 입력·셀렉트·버튼 테두리 | **필수** — 어디에 입력하는지 알려준다 | `--line-strong` (3.06:1) |

모든 테두리를 3:1로 올리면 화면이 과도하게 무거워집니다. 기준을 완화한 것이 아니라
**적용 대상을 정확히 구분한 것**입니다.

`--line-strong`은 카드가 아니라 **입력 자체의 배경(`--surface-2`)** 기준으로 맞췄습니다 —
입력 테두리가 실제로 놓이는 곳이 거기입니다.
