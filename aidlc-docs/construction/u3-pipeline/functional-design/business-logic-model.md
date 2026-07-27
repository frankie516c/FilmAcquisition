# Business Logic Model — U3 Pipeline

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U3 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 구성 요소

| 파일 | 역할 |
|---|---|
| `modules/pipeline/service.ts` | 단계 전환 (T1) |
| `domain/pipeline-rules.ts` | D5 — 단계 정의·전환 판정 (순수) |
| `domain/dwell-time.ts` | D2 — 체류 일수·병목 (순수, PBT 4속성) |
| `domain/calendar.ts` | `dayIndex` — D2의 기반 |
| `app/(app)/board/` | 칸반 화면 |

---

## 2. 단계 전환 흐름 (T1)

```
POST /api/pipeline/{id}/stage   { toStage, note? }
 1. requireContext()                              미인증 → 401
 2. validate(bodySchema)                          잘못된 단계 값 → 400
 3. changeStage(ctx, titleId, toStage, note)
      a. requireRole(ctx, SCOUT, ANALYST)         Executive → 403
      b. Title 조회                                없으면 → 404
      c. isValidTransition(from, to)              from===to → 400 SAME_STAGE
      d. runInTransaction:
           StageTransition.create(from, to, ctx.userId, ctx.now, note)
           Title.update(stage = to)
 4. serialize → 200
```

**권한 확인이 조회보다 먼저입니다.** 권한이 없으면 작품 존재 여부조차 알려주지 않습니다.

**이력을 먼저 만들고 단계를 갱신합니다.** 순서가 결과를 바꾸지는 않지만(트랜잭션이므로),
"이력이 주(主)이고 현재 단계는 그 파생"이라는 관점이 코드에 드러납니다.

---

## 3. D5 — 단계 규칙 (순수 함수)

```ts
STAGES = [DISCOVERY, SCREENING, EVALUATION, OFFER, NEGOTIATION, CLOSED_WON, REJECTED]
TERMINAL_STAGES = [CLOSED_WON, REJECTED]

isValidTransition(from, to) = from !== to
getStageLabel(stage)        = 한국어 표시명
isTerminal(stage)           = TERMINAL_STAGES에 포함되는가
```

**전이 표를 두지 않았습니다.** 7×7 표를 만들어도 전부 `true`가 되므로(대각선만 제외)
표현이 오히려 의도를 흐립니다.

---

## 4. D2 — 체류 일수 (순수 함수, PBT 4속성)

### 4.1 구간 분할

```
calculateDwellSegments(createdAt, transitions, now):

 1. transitions를 occurredAt 오름차순 정렬          입력 순서를 신뢰하지 않는다
 2. boundaries = [createdAt, t₁, t₂, …, tₙ, now]
 3. 각 구간 i (0 ≤ i ≤ n):
      stage     = i===0 ? (t₁.fromStage ?? DISCOVERY) : transitions[i-1].toStage
      enteredAt = boundaries[i]
      exitedAt  = 마지막 구간이면 null, 아니면 boundaries[i+1]
      days      = dayIndex(boundaries[i+1]) − dayIndex(boundaries[i])
```

### 4.2 왜 이 정의여야 하는가

구간이 경계를 공유하므로 차분의 합이 **망원 급수로 정확히 상쇄**됩니다.

```
(d₁−d₀) + (d₂−d₁) + … + (dₙ−dₙ₋₁) = dₙ − d₀
```

곧 `Σ days = dayIndex(now) − dayIndex(createdAt)` 이며, 이것이 PBT의 P2입니다.

**대안이 왜 안 되는가**: 각 구간을 "시각 차이 ÷ 86,400,000 후 내림"으로 계산하면 구간마다
최대 하루 미만의 나머지가 버려지고, 그것이 누적되어 총합이 경과 일수보다 작아집니다.
구간이 많을수록 오차가 커지므로 테스트 데이터가 적으면 발견되지 않습니다.

### 4.3 경계 조건

| 상황 | 처리 |
|---|---|
| 이력 0건 | 구간 1개, `stage=DISCOVERY`, `exitedAt=null` |
| 같은 날 여러 번 이동 | 해당 구간 `days=0` — 정상 |
| 종료 단계에서 되돌리기 | 특별 처리 없음. 하나의 전환으로 새 구간 생성 |
| 시계 역행 | 발생하지 않는다고 가정. `occurredAt`과 `now`가 같은 출처(`ctx.now`)라 단조 증가 |

### 4.4 병목 산출

```
findBottleneckStage(전 작품의 구간 배열):
 1. 종료 단계 구간을 제외하고 단계별로 모은다
 2. 단계별 평균 = Σdays / 구간수
 3. 평균 최대 단계 반환. 동점이면 STAGES 순서에서 앞선 것
 4. 구간이 하나도 없으면 null
```

**작품 수가 아니라 구간 수로 나눕니다.** 한 작품이 같은 단계를 두 번 거치면 두 구간이며,
각각이 독립된 관찰입니다.

---

## 5. 칸반 보드 데이터 구성

```
BoardPage (서버):
  listTitles()                     // 전 작품 + 평가 + 딜
  columns = STAGES.map(stage => ({
    stage, label,
    cards: 해당 단계 작품 (제목·담당자·종합점수),
    offerTotal: Σ deal.offerAmount,
    hasOffers: 하나라도 오퍼가 있는가
  }))
  editable = canPerform(role, "pipeline:changeStage")
  → <Board columns editable />
```

**금액 문자열을 서버에서 만들어 내려보냅니다.** `bigint`는 클라이언트 컴포넌트 props로
직렬화되지 않습니다. `formatKrw()`로 미리 문자열화합니다.

**`hasOffers`를 따로 내려보내는 이유**: 합계가 0원인 것과 딜이 아예 없는 것을 구분해
`0원` 대신 `오퍼 없음`을 표시하기 위함입니다.

---

## 6. 드래그 앤 드롭 (클라이언트)

```
onDragStart  → dragId 저장
onDragOver   → preventDefault (드롭 허용) + 열 하이라이트
onDrop       → POST /api/pipeline/{dragId}/stage { toStage: 열의 단계 }
                성공 → 안내 메시지 + router.refresh()
                실패 → 상태코드·코드·메시지를 그대로 표시
```

**`editable`이 false면 핸들러가 아무 일도 하지 않습니다.** `draggable` 속성도 붙지 않습니다.
다만 이것은 편의일 뿐이고 **실제 차단은 서버**가 합니다.

**낙관적 업데이트를 하지 않습니다.** 카드를 즉시 옮기지 않고 서버 응답 후 `router.refresh()`로
다시 그립니다. 서버가 거부했는데 화면만 옮겨진 상태를 만들지 않기 위함이며, 로컬 응답이
수십 ms라 체감 지연이 없습니다.

**성공 메시지에 규칙을 함께 알립니다** — *"단계가 변경되고 이력이 추가되었습니다 (수정·삭제 불가)"*.

---

## 7. 이력 표시 (작품 상세)

```
segments = calculateDwellSegments(createdAt, transitions, ctx.now)
dwellTotal = Σ segments.days
elapsed    = dayIndex(ctx.now) − dayIndex(createdAt)

행마다:  단계명 | 진입일 → 이탈일(또는 "진행 중") | N일
하단:    "체류 일수 총합 / 등록 후 경과"  →  [일치] 또는 [불일치] 배지
```

**불변식을 화면에 노출한 이유**: 이 값이 어긋나면 즉시 눈에 띕니다. 테스트가 잡지 못한
경로에서 이력이 누락되면 사용자가 먼저 발견합니다.

그 아래에 *"두 값이 항상 일치하는 것이 속성 기반 테스트로 검증되는 성질입니다."* 라고
적어 배지의 의미를 설명합니다.
