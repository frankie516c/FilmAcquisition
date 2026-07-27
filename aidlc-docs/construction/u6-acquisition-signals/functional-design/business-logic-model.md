# Business Logic Model — U6 Acquisition Signals

**작성일**: 2026-07-27
**단계**: 🟢 CONSTRUCTION — U6 Functional Design

---

## 1. 계층 배치

기존 구조를 그대로 따릅니다.

```
src/domain/signal-rules.ts      ← 순수 함수. import 금지 구역
src/domain/kobis-link.ts        ← 순수 함수. 외부 호출 없음
src/modules/signals/service.ts  ← 권한 판정 + 트랜잭션
src/modules/signals/repository.ts ← 행 단위 권한이 질의에 박히는 곳
src/app/api/titles/[id]/signals/route.ts
src/app/api/signals/[id]/retract/route.ts
src/app/api/titles/[id]/comparables/route.ts
```

**`src/domain/`은 외부 의존이 없습니다.** Prisma·HTTP·프레임워크를 import하지 않습니다.
덕분에 속성 기반 테스트가 붙습니다.

---

## 2. 도메인 순수 함수

### D7 — `signal-rules.ts`

```
validateSignal(input, now) → ValidationIssue[]
```

빈 배열이면 유효합니다. **던지지 않고 반환합니다** — 화면이 모든 문제를 한 번에 보여줘야
하는데, 첫 오류에서 던지면 사용자가 고칠 때마다 다음 오류를 새로 만나게 됩니다.

검사 순서와 내용:

| # | 검사 | 코드 |
|---|---|---|
| 1 | `body` 공백 제외 후 비어 있지 않은가 | `VALIDATION_FAILED` |
| 2 | `observedAt <= now` (순간 비교) | `FUTURE_OBSERVATION` |
| 3 | `sourceGrade === PUBLIC` → `sourceUrl` 있음 | `PUBLIC_SOURCE_URL_REQUIRED` |
| 4 | 종류별 조건부 필수 (아래 표) | `VALIDATION_FAILED` |

```
REQUIRED_BY_KIND: Record<SignalKind, readonly Field[]>
  SALES_POINT     → []
  REVIEW          → ["sourceName", "reviewTone"]
  TRAILER_METRIC  → ["metricValue"]
  BUYER_INTEREST  → ["sourceName"]
  MARKET_NOTE     → ["sourceName"]
  OTHER           → []
```

**표로 둔 이유**: `if (kind === "REVIEW") ... else if ...` 로 쓰면 종류를 추가할 때
검증 분기를 잊습니다. 표는 새 종류를 추가할 때 **컴파일러가 빈칸을 지적합니다**
(`Record<SignalKind, ...>`는 전수를 요구합니다).

이건 권한 정책 테이블에서 쓴 방식과 같습니다 — 미등재 항목이 조용히 통과하지 않게 합니다.

```
isRetractable(signal, ctx) → boolean
```
`signal.retractedAt === null && (ctx.role !== "SCOUT" || signal.recordedById === ctx.userId)`

```
countActive(signals) → number
```
철회되지 않은 것만 셉니다 (BR-U6-010).

```
toneDistribution(signals) → { positive, neutral, negative }
```
`REVIEW`이면서 철회되지 않은 것만 집계합니다.

### D8 — `kobis-link.ts`

```
kobisSearchUrl(name: string, year?: number) → string
```

**외부 호출이 아닙니다.** 검색 URL 문자열을 조립할 뿐입니다. 조회와 입력은 사람이 합니다
(Q-U6-3 = B).

```
https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieList.do?sMovName={encoded}
```

`encodeURIComponent`로 감싸고, 이름이 공백뿐이면 `null`을 반환합니다 — 빈 검색 링크를
띄우면 사용자가 눌렀다가 아무것도 없는 페이지를 만납니다.

**순수 함수라 테스트됩니다.** 한글·특수문자·공백 인코딩을 단위 테스트로 고정합니다.

---

## 3. 흐름

### 3.1 관측 기록

```
POST /api/titles/{id}/signals
  │
  ├ requireContext()                    세션 → ctx (역할은 매 요청 DB에서 읽는다)
  ├ requireRole(ctx, "signal:create")    Executive면 여기서 403
  ├ Zod 스키마 파싱                       타입·길이·enum
  ├ validateSignal(input, ctx.now)       ← 도메인 규칙. 문제 배열을 받는다
  │    비어 있지 않으면 → 400 + fields[]
  ├ 작품 존재 확인                        없으면 404
  └ INSERT
       └ 201 + serialize(role, "Signal", created)
```

**`ctx.now`를 주입합니다.** 도메인 함수가 전역 시각을 읽지 않습니다 — 읽으면 테스트에서
시간을 고정할 수 없고, "미래 거부" 규칙을 검증할 방법이 사라집니다.

### 3.2 관측 조회 — 행 단위 권한이 박히는 곳

```
GET /api/titles/{id}/signals?kind=REVIEW
  │
  ├ requireContext()
  └ signalRepository.findByTitle(ctx, titleId, { kind })
       │
       └ SELECT ... WHERE titleId = ?
                      AND (kind = ? OR ? IS NULL)
                      AND ( sourceGrade <> 'INTERNAL'
                            OR ctx.role IN ('ANALYST','EXECUTIVE')
                            OR recordedById = ctx.userId )
                    ORDER BY observedAt DESC
```

**이 `WHERE`가 U6의 안전 장치입니다.** 서비스 계층에서 거르지 않는 이유는
`business-rules.md` BR-U6-005에 있습니다 — 걸러지지 않은 배열이 **애초에 메모리에
존재하지 않아야** 합니다.

리포지토리에 `ctx`를 받지 않는 조회 메서드를 두지 않으므로, **새 화면을 만드는 사람이
권한을 잊을 수 있는 경로 자체가 없습니다.**

### 3.3 철회 (T8)

```
POST /api/signals/{id}/retract   { reason }
  │
  ├ requireContext()
  └ transaction
       ├ SELECT ... FOR UPDATE          ← 경합 차단
       ├ 없거나 볼 권한 없음 → 404       ← 403이 아니다 (존재를 감춘다)
       ├ isRetractable(signal, ctx) 아니면
       │    이미 철회됨 → 409 ALREADY_RETRACTED
       │    권한 없음   → 403 FORBIDDEN
       └ UPDATE retractedAt, retractedById, retractionReason
```

**철회는 `UPDATE`지만 BR-U6-001을 위반하지 않습니다.** 생성 시 `null`인 필드를 한 번만
채우는 것이지 기존 내용을 바꾸는 것이 아닙니다. 그래서 `UPDATE`의 `SET` 절에 `body`나
`sourceGrade`가 들어갈 수 없도록 **전용 메서드**로 좁힙니다.

### 3.4 내보내기 — `INTERNAL` 제외 지점

```
GET /api/export/titles?format=csv
  │
  ├ requireRole(ctx, "export:execute")
  ├ 리포지토리 조회
  │    └ signals: { where: { sourceGrade: { not: "INTERNAL" } } }   ← 여기
  ├ gateExportRows(role, rows)          기존 직렬화 게이트
  └ CSV/PDF/Excel 생성
```

**게이트 이전에 제외합니다.** 순서가 바뀌면 파일 생성 코드가 원본 배열을 참조할 여지가
남습니다 — `genres`가 API 응답에서 사라졌는데 서버 렌더링 화면에서는 보였던 결함과
같은 구조입니다.

**역할과 무관합니다.** Executive도 `INTERNAL`을 내보낼 수 없습니다.

### 3.5 유사작 등록

```
POST /api/titles/{id}/comparables
  ├ requireRole(ctx, "comparable:write")   Scout·Analyst
  ├ Zod 파싱 + basis 필수 확인
  ├ sourceGrade === PUBLIC → sourceUrl 필수
  └ INSERT → 201
```

KOBIS 링크는 저장하지 않습니다. **`comparableName`과 `releaseYear`로 화면에서 조립**합니다
— URL 형식이 바뀌면 저장된 링크는 전부 죽지만, 조립하면 함수 한 곳만 고치면 됩니다.

---

## 4. 근거 탭 데이터 구성

```
작품 상세 서버 컴포넌트
  ├ findTitleDetail(id)                  기존
  ├ signalRepository.findByTitle(ctx, id)  ← 행 단위 권한 적용
  ├ comparableRepository.findByTitle(id)
  └ 화면 데이터
       ├ signals        관측일 역순, 철회 건 포함
       ├ activeCount    countActive(signals)     ← 철회 제외
       ├ toneDist       toneDistribution(signals)
       └ comparables    등록순
```

**`activeCount`와 목록 길이가 다릅니다.** 의도된 것입니다 (BR-U6-010) — 화면에
`유효 7건 / 전체 9건`처럼 함께 표시해 차이를 설명합니다.

---

## 5. 권한 정책 반영

```ts
// ACTION_POLICY 추가
"signal:create":     ["SCOUT", "ANALYST"],
"signal:retract":    ["SCOUT", "ANALYST", "EXECUTIVE"],  // Scout는 본인 것만 (행 단위)
"comparable:write":  ["SCOUT", "ANALYST"],

// FIELD_POLICY 추가
Signal:          { kind: "open" },
ComparableTitle: { kind: "open" },

// RELATION_MAP.Title 추가
signals:          "Signal",
comparableTitles: "ComparableTitle",
Signal:           { recordedBy: "User", retractedBy: "User" },
ComparableTitle:  { recordedBy: "User" },
```

**`Signal`이 `open`인 이유**: 필드 단위로 막을 것이 없습니다. 통제 대상은 필드가 아니라
**레코드 전체**이고, 그건 리포지토리 질의가 담당합니다.

**`signal:retract`가 세 역할 전부인 이유**: 동작 권한은 "이 동작을 시도할 수 있는가"만
판정합니다. Scout가 **남의 관측**을 철회하려 하면 `isRetractable`이 막습니다. 두 층이
필요한 이유는 동작 권한 테이블이 행을 모르기 때문입니다.

---

## 6. 테스트 설계

### 6.1 단위 (도메인 순수 함수)

| # | 대상 | 검사 |
|---|---|---|
| 1 | `validateSignal` | 종류 6종 × 필수 필드 누락 → 정확한 코드 반환 |
| 2 | `validateSignal` | `observedAt === now` 허용, `now + 1ms` 거부 |
| 3 | `validateSignal` | `PUBLIC` + URL 없음 거부, `INTERNAL` + URL 없음 허용 |
| 4 | `validateSignal` | 문제가 여러 개면 **전부** 반환 (첫 개에서 멈추지 않음) |
| 5 | `isRetractable` | 철회됨 / 본인 / 타인 × 3역할 |
| 6 | `countActive` | 철회 건 제외 |
| 7 | `toneDistribution` | `REVIEW` 아닌 것·철회 건 제외 |
| 8 | `kobisSearchUrl` | 한글·공백·특수문자 인코딩 |
| 9 | `kobisSearchUrl` | 공백뿐인 이름 → `null` |

**속성 기반 테스트는 붙이지 않습니다.** NFR-007이 PBT를 순수 계산과 직렬화 왕복 두
영역으로 한정했습니다. 검증 규칙은 표로 열거하는 편이 성질을 만들어내는 것보다 정확합니다.

### 6.2 통합

| # | 시나리오 | 건수 |
|---|---|---|
| S11 | 종류별 검증 거부 (6종) | 6 |
| S12 | **행 단위 권한** — Scout가 남의 `INTERNAL`은 404, 본인 것은 200 | 4 |
| S13 | **NFR-010 전수** — 3역할 × 3형식에 `INTERNAL` 미포함 | 9 |
| S14 | 철회 — 본인/타인/이미 철회(409)/집계 반영 | 4 |
| S15 | 유사작 — 기준 없음 거부, Scout 등록 성공, Executive 403 | 3 |

**S13이 핵심입니다.** 역할이 아니라 **경로**를 전수로 확인합니다 — Executive도 못 내보낸다는
것을 명시적으로 검사해야 "관리자니까 되겠지"라는 구현이 들어오지 않습니다.

### 6.3 이 단위가 잡을 수 없는 것

**UI 배선은 여전히 검사되지 않습니다.** 결함 10·11이 그 공백에서 나왔습니다 — 입력 폼이
`sourceGrade`를 실제로 보내는지, 근거 탭이 관측을 실제로 그리는지는 사람이 봐야 합니다.

U6 코드 생성 시 **화면에서 직접 확인할 항목 목록**을 함께 만듭니다. E2E 도입 전까지는
그게 최선입니다.

---

## 7. 마이그레이션 순서

```
1. enum 4종 생성 (SignalKind, SourceGrade, ReviewTone, ComparableBasis, PremiereStatus)
2. Signal 테이블 생성 + 인덱스 2개
3. ComparableTitle 테이블 생성
4. FestivalRecord.premiereStatus 컬럼 추가 (nullable, 백필 없음)
```

**4번을 백필하지 않습니다.** `NONE`으로 채우면 **모르는 것을 "해당 없음"으로 단정**하게
됩니다. `null`은 "아직 기록하지 않음"이고 `NONE`은 "프리미어가 아님"입니다.

알림 중복 키 마이그레이션과 달리 기존 데이터를 건드리지 않으므로 Prisma가 비대화형에서도
생성할 수 있습니다.
