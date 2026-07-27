# Frontend Components — U2 Title & Evaluation

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U2 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 컴포넌트 계층

```
app/(app)/titles/
├── page.tsx                서버 · 목록
│   └── export-button.tsx   클라이언트 · CSV 내보내기 (U5)
├── new/
│   ├── page.tsx            서버 · 권한 게이트
│   └── title-form.tsx      클라이언트 · 등록 폼
└── [id]/
    ├── page.tsx            서버 · 상세 (조립 지점)
    ├── title-edit.tsx      클라이언트 · 수정·삭제
    ├── evaluation-form.tsx 클라이언트 · 평가 입력
    ├── comment-form.tsx    클라이언트 · 코멘트 + 멘션
    ├── deal-form.tsx       클라이언트 · 딜·재무 (U4)
    └── rights-section.tsx  클라이언트 · 판권 (U4)
```

`[id]/page.tsx`가 조립 지점입니다. 데이터를 한 번에 조회하고 권한을 판정해 각 클라이언트
컴포넌트에 필요한 것만 내려보냅니다.

---

## 2. `titles/page.tsx` — 목록

**타입**: 서버 컴포넌트

**입력**: `searchParams` (`stage`, `q`) — 필터 상태가 URL에 있습니다 (BR-U2-008)

**동작**
```
requireContext() → listTitles({stage, q}) → 각 행의 deal만 serialize()
```

**권한별 헤더 구성**

| 조건 | 표시 |
|---|---|
| `title:write` | `+ 작품 등록` 링크 |
| `import:commit` | `CSV 가져오기` 링크 |
| `export:execute` | `CSV 내보내기` 버튼 |
| 내보내기 권한 없음 | `내보내기 권한 없음` 안내 배지 |

> 권한이 없을 때 **버튼을 숨기지 않고 안내를 보여줍니다.** 기능이 없는 것인지 권한이 없는
> 것인지 사용자가 구분할 수 있어야 합니다.

**표시 항목**: 제목(+원제) · 장르 · 제작(국가·연도) · 단계 배지 · 종합점수(+건수) · 오퍼 금액 · 상세 링크

오퍼 금액은 `serialize()`를 통과한 값이라 역할에 따라 달라집니다.

---

## 3. `titles/new/` — 등록

### 3.1 `page.tsx` (서버)

`canPerform(role, "title:write")` 판정. 권한이 없으면 폼 대신 안내 화면을 보여줍니다 —
*"API를 직접 호출해도 403이 반환됩니다."*

### 3.2 `title-form.tsx` (클라이언트)

**상태**

| 이름 | 용도 |
|---|---|
| `titleKo` `titleOriginal` `director` `year` `synopsis` | 입력값 |
| `genres` | `string[]` — 토글 버튼으로 다중 선택 |
| `issues` | 서버가 준 필드별 오류 |
| `candidates` | 중복 후보 |
| `pending` | 제출 중 |

**API**

| 시점 | 호출 |
|---|---|
| 원제·연도 `onBlur` | `GET /api/titles?titleOriginal=…&productionYear=…` |
| 제출 | `POST /api/titles` → 성공 시 `/titles/{id}`로 이동 |

**중복 경고 UI**: 노란 상자에 후보를 알약 링크로 나열합니다. **등록 버튼은 그대로 활성**입니다.

**장르 선택**: `<select multiple>` 대신 토글 알약을 씁니다. 12개 중 보통 1~2개를 고르는데
다중 선택 셀렉트는 조작이 번거롭고 선택 상태가 한눈에 안 보입니다.

---

## 4. `titles/[id]/page.tsx` — 상세 (조립)

**타입**: 서버 컴포넌트

**조회**: `findTitleDetail(id)` 한 번으로 작품·평가·코멘트·영화제·이력·판권·딜·재무를 모두 가져옵니다.

**계산**
```
deal        = serialize(role, "Deal", title.deal)        마스킹 적용
finance     = canReadEntity(role,"FinancialModel") ? calculateFinancials(...) : null
segments    = calculateDwellSegments(createdAt, transitions, ctx.now)
score       = calculateOverallScore(evaluations)
memberNames = 전체 사용자 − 본인            멘션 후보
```

**권한별 조건부 렌더링**

| 조건 | 컴포넌트 |
|---|---|
| `title:write` | `TitleEdit` |
| `evaluation:write` | `EvaluationForm` |
| `deal:update` | `DealForm` |
| `rights:write` | `RightsSection`의 추가 폼 |
| 전 역할 | `CommentForm` |

**레이아웃**: 2열 그리드. 왼쪽은 딜·재무·판권·이력(금액과 시간), 오른쪽은 평가·영화제·코멘트(사람의 판단).

---

## 5. `title-edit.tsx` — 수정·삭제

**props**: `titleId`, `initial: TitleEditValues`, `hasChildren: boolean`

**상태**: `open`(폼 열림), `v`(입력값), `issues`, `message`, `pending`, `confirmDelete`

**삭제는 2단계입니다.**
```
[삭제] 클릭 → 경고 배지 + [정말 삭제] [취소] 노출 → [정말 삭제] 클릭 시 실행
```

`hasChildren`에 따라 경고 문구가 달라집니다 (BR-U2-005).

**`window.confirm`을 쓰지 않는 이유**: 브라우저 기본 대화상자는 한글 문구의 줄바꿈이 제어되지
않고 어떤 데이터가 사라지는지 설명하기 어렵습니다.

**API**: `PATCH /api/titles/{id}`, `DELETE /api/titles/{id}` (성공 시 `/titles`로 이동)

**폼 하단 안내**: *"파이프라인 단계는 여기서 바꿀 수 없습니다…"* — 없는 기능을 찾아 헤매지
않도록 이유와 함께 알려줍니다.

---

## 6. `evaluation-form.tsx` — 평가 입력

**props**: `titleId`

**상태**: `open`, `scores: Record<Key, number>`(기본 3점), `comment`, `venue`, `message`, `pending`

**점수 입력**: 항목마다 1~5 알약 버튼. 슬라이더나 숫자 입력이 아닙니다 — 5단계 이산값이고
현재 선택이 한눈에 보여야 합니다.

**실시간 평균 표시**: 입력 중 `이 평가의 점수`가 갱신됩니다. 서버 왕복 없이 클라이언트에서
계산하되, **저장되는 값은 서버가 다시 계산**합니다.

**API**: `POST /api/titles/{id}/evaluations`

성공 메시지: *"평가를 등록했습니다. 기존 평가는 그대로 보존됩니다."* — 덮어쓰기가 아님을 알립니다.

---

## 7. `comment-form.tsx` — 코멘트 + 멘션

**props**: `titleId`, `memberNames: string[]` (본인 제외)

**상태**: `body`, `message`, `pending`

**멘션 입력 보조**: 이름 알약을 누르면 `@이름 `이 본문 끝에 삽입됩니다. 자동완성 드롭다운은
만들지 않았습니다 — 사용자가 5명뿐이라 버튼 나열이 더 빠릅니다.

**API**: `POST /api/titles/{id}/comments`

**응답의 `notified`를 그대로 안내합니다**: *"등록했습니다. 멘션 알림 2건이 생성되었습니다."*

**본인을 멘션 후보에서 제외**: 서버가 작성자에게 알림을 만들지 않으므로 버튼도 두지 않습니다.
누를 수 있는데 아무 일도 안 일어나는 것이 가장 나쁩니다.

---

## 8. 화면 ↔ API 매핑 (U2)

| 화면 | API |
|---|---|
| `/titles` | (서버 직접 조회) |
| `/titles/new` | `GET /api/titles` (중복), `POST /api/titles` |
| `/titles/[id]` | (서버 직접 조회) |
| 수정·삭제 | `PATCH·DELETE /api/titles/{id}` |
| 평가 | `POST /api/titles/{id}/evaluations` |
| 코멘트 | `POST /api/titles/{id}/comments` |

---

## 9. 공통 규약

| 항목 | 방식 |
|---|---|
| 오류 표시 | 서버 `fields[]`를 `issueFor(path)`로 해당 입력 아래에 |
| 성공 후 갱신 | `router.refresh()` — 서버 컴포넌트를 다시 렌더 |
| 중복 제출 방지 | `pending` 상태로 버튼 비활성 |
| 검증 규칙 복제 금지 | 범위·형식·순서 판정은 서버 단독 |
