# Domain Entities — U6 Acquisition Signals

**작성일**: 2026-07-27
**단계**: 🟢 CONSTRUCTION — U6 Functional Design
**기반**: `requirements-u6-signals.md` (FR-025~043), 계획서 Q-FD-1~4 = A

> **이 문서는 구현 전에 작성되었습니다.** U2~U5의 functional-design 문서는 시간 제약으로
> 구현 후에 쓴 as-built 기록이었습니다. U6는 원래 순서를 회복합니다.

---

## 1. 이 단위가 다루는 개념

현재 시스템은 **"무엇을 결정했는가"**를 기록합니다 — 어느 단계로 옮겼고, 얼마를 제시했고,
누가 몇 점을 줬는지. 하지만 **"왜 그렇게 판단했는가"**는 없습니다.

U6은 판단의 재료를 남깁니다. 핵심 개념은 **관측(Signal)** 하나입니다.

> **관측이란**: 우리 밖에서 일어난 일을, 출처를 밝혀, 관측한 시점과 함께 기록한 것.

이 정의에 세 가지가 박혀 있고 셋 다 필수입니다.

| 요소 | 없으면 |
|---|---|
| **밖에서 일어난 일** | 우리 의견이 됩니다. 그건 `Evaluation`이 이미 담습니다 |
| **출처** | 소문이 됩니다. 재확인할 수 없는 정보는 근거가 아닙니다 |
| **관측 시점** | 3월의 조회수인지 7월의 조회수인지 알 수 없습니다 |

---

## 2. 신규 엔티티

### 2.1 `Signal` — 관측

| 속성 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `String` (cuid) | ✅ | |
| `titleId` | `String` | ✅ | 대상 작품. 작품 삭제 시 `Cascade` |
| `kind` | `SignalKind` | ✅ | 관측 종류 (2.2절) |
| `sourceGrade` | `SourceGrade` | ✅ | 출처 등급 (2.3절). **기본값 없음** |
| `observedAt` | `DateTime` | ✅ | **관측 시점.** `createdAt`과 다르다 |
| `body` | `String` | ✅ | 본문 |
| `sourceName` | `String?` | 조건부 | 매체·기관·에이전트명 (2.4절) |
| `sourceUrl` | `String?` | 조건부 | `PUBLIC`일 때 필수 (FR-028) |
| `reviewTone` | `ReviewTone?` | 조건부 | `REVIEW`일 때 필수 |
| `keywords` | `String[]` | — | 자유 태그 (Q-FD-2 = A) |
| `metricValue` | `Int?` | 조건부 | `TRAILER_METRIC`일 때 필수 |
| `recordedById` | `String?` | ✅ | 기록자. 사용자 삭제 시 `SetNull` |
| `retractedAt` | `DateTime?` | — | 철회 시각. `null`이면 유효 |
| `retractedById` | `String?` | — | 철회한 사람 |
| `retractionReason` | `String?` | — | 철회 사유 |
| `createdAt` | `DateTime` | ✅ | 생성 시각 |

**`updatedAt`이 없습니다.** 이 표에서 가장 중요한 항목입니다.

수정되지 않는 테이블이라는 사실이 **스키마에 드러나야** 합니다. `updatedAt`을 습관적으로
달아두면, 나중에 읽는 사람은 "수정되는 테이블이구나"라고 이해하고 수정 경로를 만듭니다.
`StageTransition`에서 같은 판단을 했습니다.

**인덱스**
```
@@index([titleId, observedAt])   -- 근거 탭이 관측일 역순으로 읽는다
@@index([titleId, kind])         -- 종류 필터 (Q-FD-4 = A)
```

**`recordedById`가 nullable인 이유**: 사용자가 삭제되어도 관측은 남아야 합니다. 관측의
가치는 기록자가 아니라 **관측된 사실**에 있습니다. 다만 `SetNull` 이후에는 "누가 봤는지"를
잃으므로, 화면에서는 `(삭제된 사용자)`로 표시합니다 — `StageTransition`과 같은 처리입니다.

### 2.2 `SignalKind` — 관측 종류

| 값 | 한글 | 무엇을 담나 |
|---|---|---|
| `SALES_POINT` | 세일즈 포인트 | 세일즈 에이전트가 강조하는 판매 논거 |
| `REVIEW` | 해외 리뷰 | 매체·평론가의 반응 |
| `TRAILER_METRIC` | 트레일러 지표 | 조회수 등 시점 수치 |
| `BUYER_INTEREST` | 바이어 관심 | 다른 바이어의 움직임 |
| `MARKET_NOTE` | 시장 메모 | 마켓 리포트 요지, 업계 동향 |
| `OTHER` | 기타 | 위에 안 들어가는 것 |

**영화제 초청·수상은 `SignalKind`에 없습니다.** `FestivalRecord`가 이미 담고 있고,
구조화된 필드(부문·수상 여부·연도)를 갖고 있어 자유 텍스트 관측으로 옮기면 **정보가
줄어듭니다.**

**소수 초청 시사 메모도 없습니다.** `Evaluation`이 `screeningDate`·`screeningVenue`·
`screeningAttendees`·`overallComment`로 이미 담습니다.

### 2.3 `SourceGrade` — 출처 등급

**신뢰도 등급이 아니라 법적 지위 등급입니다.** 이 구분이 U6에서 가장 중요합니다.

| 값 | 한글 | 예 | 위험 |
|---|---|---|---|
| `PUBLIC` | 공개 | 영화제 공식 발표, 매체 리뷰, 공개 트레일러 | 없음. 누구나 재확인 가능 |
| `SEMI_PUBLIC` | 준공개 | 바이어 코멘트, 업계 인터뷰, 마켓 현장 대화 | 실명 귀속이 유출되면 **관계 파탄·명예훼손** |
| `INTERNAL` | 내부 | 소수 초청 시사 메모, 내부 판단 | 상당수가 **NDA 하에 관람.** 유출 시 세일즈 에이전트와의 거래 종료 |

**기본값을 두지 않습니다.** `NOT NULL` + 기본값 없음으로 정의합니다. 기본값이 있으면
등급을 고르지 않은 관측에 조용히 `PUBLIC`이 붙고, **가장 위험한 실수가 가장 조용히**
일어납니다.

### 2.4 종류별 조건부 필수 필드

| `kind` | `sourceName` | `sourceUrl` | `reviewTone` | `metricValue` |
|---|---|---|---|---|
| `SALES_POINT` | — | 등급 규칙 | — | — |
| `REVIEW` | ✅ | 등급 규칙 | ✅ | — |
| `TRAILER_METRIC` | — | 등급 규칙 | — | ✅ |
| `BUYER_INTEREST` | ✅ | 등급 규칙 | — | — |
| `MARKET_NOTE` | ✅ | 등급 규칙 | — | — |
| `OTHER` | — | 등급 규칙 | — | — |

- **등급 규칙**: `sourceGrade === PUBLIC`이면 `sourceUrl` 필수 (FR-028)
- **`sourceName` 필수 3종**의 근거: 리뷰·바이어 관심·시장 메모는 **"누가 말했나"가 곧
  신호**입니다. 출처 없는 평판은 소문입니다 (계획서 D-2)

### 2.5 `ReviewTone` (Q-FD-2 = A → 3단계)

| 값 | 한글 |
|---|---|
| `POSITIVE` | 긍정 |
| `NEUTRAL` | 중립 |
| `NEGATIVE` | 부정 |

5단계를 쓰지 않은 이유: 사람이 `매우긍정`과 `긍정`을 일관되게 구분하지 못합니다.
구분이 흔들리는 눈금은 정밀해 보일 뿐 정밀하지 않습니다.

---

### 2.6 `ComparableTitle` — 유사작

| 속성 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `String` (cuid) | ✅ | |
| `titleId` | `String` | ✅ | 대상 작품. `Cascade` |
| `comparableName` | `String` | ✅ | 유사작명 |
| `releaseYear` | `Int` | ✅ | 개봉연도 |
| `basis` | `ComparableBasis` | ✅ | **유사 판단 기준** (FR-032) |
| `basisNote` | `String?` | — | 기준 부연 |
| `domesticAdmissions` | `Int?` | — | 국내 관객수(명) |
| `overseasNote` | `String?` | — | 해외 성과 (자유 서술) |
| `sourceGrade` | `SourceGrade` | ✅ | |
| `sourceUrl` | `String?` | 조건부 | `PUBLIC`일 때 필수 |
| `recordedById` | `String?` | ✅ | `SetNull` |
| `createdAt` | `DateTime` | ✅ | |

**`basis`가 필수인 것이 이 엔티티의 핵심입니다.** 없으면 원하는 결론에 맞는 유사작을 골라
붙이는 **확증편향 기계**가 됩니다. 기준을 강제하면 최소한 무엇을 근거로 묶었는지가 남고,
나중에 "감독 기준으로 묶었는데 장르가 전혀 다르네"라는 반박이 가능해집니다.

| `ComparableBasis` | 한글 |
|---|---|
| `DIRECTOR` | 감독 |
| `GENRE` | 장르 |
| `COUNTRY` | 제작국 |
| `SCALE` | 규모 |
| `OTHER` | 기타 |

**해외 매출을 숫자로 두지 않았습니다.** `overseasNote`는 자유 서술입니다.
국내 관객수는 KOBIS라는 단일 기준이 있지만, 해외 매출은 환율·집계 기간·집계처가 제각각이라
숫자로 나란히 두면 **비교 불가능한 것을 비교하게 됩니다.** 숫자는 비교를 부릅니다.

**`ComparableTitle`은 `Title`을 참조하지 않습니다.** 유사작이 우리 파이프라인에 있는
작품일 수도 있지만, 대개 이미 개봉한 남의 영화입니다. 외래키로 묶으면 파이프라인에 없는
작품을 유사작으로 넣을 수 없습니다.

---

## 3. 기존 엔티티 확장

### `FestivalRecord.premiereStatus` (FR-041)

| 값 | 한글 |
|---|---|
| `WORLD` | 월드 프리미어 |
| `INTERNATIONAL` | 인터내셔널 프리미어 |
| `ASIAN` | 아시안 프리미어 |
| `KOREAN` | 한국 프리미어 |
| `NONE` | 해당 없음 |

**칸 월드프리미어와 칸에서의 3차 상영은 완전히 다른 신호인데** 현재 스키마는 구분하지
못합니다. 월드프리미어는 그 영화제가 작품을 처음 세상에 내놓았다는 뜻이고, 이는 영화제가
그 작품에 건 무게를 나타냅니다.

**기존 행 처리**: nullable로 추가합니다. `NONE`을 기본값으로 백필하면 **모르는 것을
"해당 없음"으로 단정**하게 됩니다. `null`은 "아직 기록하지 않음"이고 `NONE`은 "프리미어가
아님"입니다. 둘은 다릅니다.

---

## 4. `Signal`과 `Comment`의 경계 (계획서 D-4)

둘 다 작품에 붙는 자유 텍스트입니다. 경계를 정하지 않으면 **아무 데나 쌓입니다.**

| | `Comment` | `Signal` |
|---|---|---|
| **무엇** | 우리끼리의 대화 | 밖에서 관측한 사실 |
| **출처** | 없음 (말한 사람 = 우리) | **필수** |
| **시점** | 쓴 시각이 곧 시점 | 관측 시점과 기록 시점이 **다름** |
| **수정** | 가능 | **불가** |
| **멘션·알림** | 있음 | 없음 (D-5) |
| **예** | "이거 다음 주 회의에서 다룹시다" | "Screen Daily 리뷰 — 긍정, '절제된 연출'" |

**판별 질문 하나**: *"이 문장을 6개월 뒤 처음 보는 사람이 출처를 따라가 확인할 수 있는가?"*
- 있다 → `Signal`
- 없다 → `Comment`

---

## 5. 관계도

```
Title
 ├── signals            Signal[]           (신규)
 ├── comparableTitles   ComparableTitle[]  (신규)
 ├── festivalRecords    FestivalRecord[]   (premiereStatus 확장)
 ├── evaluations        Evaluation[]
 ├── comments           Comment[]
 ├── stageTransitions   StageTransition[]
 ├── rightsGrants       RightsGrant[]
 ├── deal               Deal?
 └── financialModel     FinancialModel?

Signal
 ├── title        Title  (Cascade)
 ├── recordedBy   User?  (SetNull)
 └── retractedBy  User?  (SetNull)

ComparableTitle
 ├── title        Title  (Cascade)
 └── recordedBy   User?  (SetNull)
```

> ⚠️ `RELATION_MAP.Title`에 `signals`·`comparableTitles`를 등록하지 않으면 직렬화 게이트가
> 통째로 차단합니다. **이는 의도된 안전 실패입니다** — 등록을 잊으면 민감 정보가 조용히
> 새는 대신 "안 보인다"는 눈에 띄는 버그로 나타납니다.

---

## 6. 불변식

| # | 불변식 | 강제 지점 |
|---|---|---|
| I-1 | 관측은 생성 후 내용이 바뀌지 않는다 | 리포지토리 메서드 부재 (컴파일 시점) |
| I-2 | 모든 관측은 출처 등급을 갖는다 | `NOT NULL`, 기본값 없음 (DB) |
| I-3 | `observedAt <= now` | 도메인 검증 |
| I-4 | `PUBLIC`이면 `sourceUrl`이 있다 | 도메인 검증 |
| I-5 | 유사작은 판단 기준을 갖는다 | `NOT NULL` (DB) |
| I-6 | 철회된 관측도 목록에서 사라지지 않는다 | 조회 시 필터하지 않음 |
| I-7 | `INTERNAL` 관측은 내보내기 산출물에 없다 | 리포지토리 질의 (NFR-010) |

**I-1·I-2·I-5는 코드가 아니라 타입과 스키마가 강제합니다.** 규율에 맡기면 언젠가 깨집니다.
