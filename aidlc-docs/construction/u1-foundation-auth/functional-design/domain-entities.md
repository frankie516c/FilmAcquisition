# Domain Entities — U1 Foundation & Auth

**작성일**: 2026-07-25
**단계**: 🟢 CONSTRUCTION — U1 Functional Design
**적용 결정**: 금액은 8바이트 정수 (Q3=A) · 열거형은 코드 상수 + 문자열 코드 저장 (Q4=A) · 세션은 DB 테이블 (Q1=A)

> **범위**: U1은 **전 엔티티 10개의 스키마를 한 번에 정의**한다. 마이그레이션이 유닛마다 누적 수정되는 것을 피하기 위함이다(unit-of-work.md U1 근거). 다만 U1에서 **동작하는 로직은 `User`·`Session`뿐**이며, 나머지 엔티티는 스키마와 리포지토리 인터페이스만 존재한다.

---

## 1. 공통 규약

| 항목 | 규칙 |
|---|---|
| **기본 키** | 모든 엔티티는 `id` (cuid 문자열). 자동 증가 정수를 쓰지 않는다 — URL에 노출되는 순차 ID로 전체 건수가 추정되는 것을 피한다 |
| **생성·수정 시각** | `createdAt` (기본값 now), `updatedAt` (자동 갱신). `StageTransition`은 예외 (아래 6절) |
| **금액 타입** | `BigInt` → PostgreSQL `int8`. **비음수 정수만 허용** (검증 계층에서 강제) |
| **날짜 타입** | 날짜만 필요한 필드는 `DateTime` 저장 후 Asia/Seoul 달력일로 해석 (business-logic-model.md 4절) |
| **열거형** | Prisma `enum`으로 정의 (DB에 문자열 코드 저장). 표시명은 코드 상수에서 매핑 |
| **삭제** | 물리 삭제. 소프트 삭제는 쓰지 않는다 (US-002가 하위 cascade 삭제를 요구) |

### 1.1 금액 타입 결정의 파급 효과

| 영향 지점 | 처리 |
|---|---|
| **JSON 직렬화** | JavaScript `BigInt`는 `JSON.stringify`에서 예외를 던진다. → **`X2` 직렬화 게이트가 모든 `BigInt`를 문자열로 변환**한다. 게이트가 유일한 출구이므로 변환 지점이 한 곳뿐이다 |
| **클라이언트 표시** | 문자열로 받아 `formatKrw`가 천 단위 구분 기호를 붙인다. 산술 연산은 클라이언트에서 하지 않는다 |
| **`D1` 재무 계산** | 입출력 모두 `bigint`. JS `bigint` 연산은 임의 정밀도이므로 오버플로가 없다 |
| **ROI 계산** | ROI는 백분율이므로 `bigint`가 아닌 `number`. 계산 시 `Number()` 변환 (business-logic-model.md 2절에서 안전 범위 근거 기술) |
| **CSV 내보내기** | 문자열로 직렬화. 왕복 시 문자열 → `BigInt` 재파싱 |
| **검증** | Zod에서 `bigint` + 비음수 + 상한 검사 (business-rules.md 5절) |

---

## 2. 열거형 정의

### 2.1 Role — 역할

| 코드 | 표시명 |
|---|---|
| `SCOUT` | 스카우트 |
| `ANALYST` | 분석가 |
| `EXECUTIVE` | 경영진 |

### 2.2 Stage — 파이프라인 단계 (7종, 순서 고정)

| # | 코드 | 표시명 | 종료 상태 |
|---|---|---|---|
| 1 | `DISCOVERY` | 발굴 | |
| 2 | `SCREENING` | 스크리닝 | |
| 3 | `EVALUATION` | 평가 | |
| 4 | `OFFER` | 오퍼 | |
| 5 | `NEGOTIATION` | 협상 | |
| 6 | `CLOSED_WON` | 계약체결 | ✅ |
| 7 | `REJECTED` | 반려 | ✅ |

### 2.3 Genre — 장르 (12종)

`DRAMA` 드라마 · `THRILLER` 스릴러 · `COMEDY` 코미디 · `ACTION` 액션 · `ROMANCE` 로맨스 · `HORROR` 공포 · `SF` SF · `FANTASY` 판타지 · `ANIMATION` 애니메이션 · `DOCUMENTARY` 다큐멘터리 · `MYSTERY` 미스터리 · `WAR` 전쟁

> 작품은 장르를 **다중 선택**한다 (`Title.genres`는 배열).

### 2.4 Rating — 관람등급 (5종, 한국 기준)

`ALL` 전체관람가 · `TWELVE` 12세이상관람가 · `FIFTEEN` 15세이상관람가 · `ADULT` 청소년관람불가 · `RESTRICTED` 제한상영가

### 2.5 Territory — 영토 (14종: 국가 9 + 권역 5)

**국가**: `KR` 대한민국 · `US` 미국 · `JP` 일본 · `CN` 중국 · `FR` 프랑스 · `GB` 영국 · `DE` 독일 · `IN` 인도 · `BR` 브라질
**권역**: `ASIA` 아시아 · `EUROPE` 유럽 · `NORTH_AMERICA` 북미 · `LATIN_AMERICA` 중남미 · `WORLDWIDE` 전세계

> **주의**: 권역과 국가가 겹칠 수 있다(예: `ASIA`와 `KR`). **충돌 검증은 하지 않는다** — requirements.md 4.2절에서 범위 밖으로 확정되었고 US-015의 수용 기준이 이를 명시적으로 허용한다.

### 2.6 ProductionCountry — 제작국가

`Territory`의 국가 9종과 동일한 코드를 사용하되 권역 5종은 제외한다.

### 2.7 FestivalSection — 영화제 부문

`COMPETITION` 경쟁 · `NON_COMPETITION` 비경쟁

### 2.8 NotificationType — 알림 유형

| 코드 | 표시명 | 생성 유닛 |
|---|---|---|
| `MENTION` | 멘션 | U2 |
| `OFFER_EXPIRY` | 오퍼 만료 임박 | U5 |
| `RIGHTS_EXPIRY` | 판권 만료 임박 | U5 |

---

## 3. User — 사용자 (U1에서 동작)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `email` | String | ✅ | **UNIQUE**. 소문자로 정규화해 저장 |
| `name` | String | ✅ | 1~50자 |
| `passwordHash` | String | ✅ | argon2id 해시. **절대 응답에 포함되지 않음** (필드 정책에서 전 역할 차단) |
| `role` | Role | ✅ | 기본값 없음 — 생성 시 명시 |
| `createdAt` | DateTime | ✅ | 기본값 now |
| `updatedAt` | DateTime | ✅ | 자동 갱신 |

**인덱스**: `email` (UNIQUE), `role` (마지막 Executive 판정 시 count 조회)
**관계**: 1:N `Session`, `Evaluation`, `Comment`, `StageTransition`, `Notification`

**삭제 시 동작**: 사용자를 삭제하면 그가 남긴 평가·코멘트·이력은 **남는다.** 작성자 참조를 `SetNull`로 처리하고 화면에는 `(삭제된 사용자)`로 표시한다.
> **근거**: `StageTransition`은 append-only이므로(FR-006) 사용자 삭제로 이력이 사라지면 US-008의 "체류 일수 총합 = 경과 일수" 속성이 깨진다. 평가·코멘트도 같은 이유로 보존한다.

---

## 4. Session — 세션 (U1에서 동작)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK. **쿠키에 담기는 값** |
| `userId` | String | ✅ | FK → User, `onDelete: Cascade` |
| `createdAt` | DateTime | ✅ | 기본값 now |
| `expiresAt` | DateTime | ✅ | 생성 시 +12시간 |

**인덱스**: `userId`, `expiresAt` (만료 세션 정리용)

**설계 의도**
- 세션 ID만 쿠키에 담고 **역할은 담지 않는다.** 매 요청마다 `Session → User`를 조회해 현재 역할을 읽으므로, Executive가 역할을 바꾸면 **다음 요청부터 즉시 반영**된다 (US-028)
- 쿠키에 `Max-Age`/`Expires`를 지정하지 않아 **브라우저 종료 시 쿠키가 사라진다** (US-026)
- `expiresAt` 12시간은 쿠키가 남아 있는 동안의 서버 측 상한이다

---

## 5. Title — 작품 (스키마만, 동작은 U2)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleKo` | String | ✅ | 1~200자. 한국어 제목 |
| `titleOriginal` | String | | 1~200자. 원제 |
| `director` | String | | 1~100자 |
| `cast` | String[] | | 배열. 각 1~100자 |
| `genres` | Genre[] | ✅ | 최소 1개 |
| `runtimeMinutes` | Int | | 1~600 |
| `productionCountry` | ProductionCountry | | |
| `productionLanguage` | String | | 1~50자 |
| `productionYear` | Int | ✅ | 1888~(현재연도+10) |
| `rating` | Rating | | |
| `synopsis` | String | | 최대 5000자 |
| `stage` | Stage | ✅ | 기본값 `DISCOVERY` |
| `assigneeId` | String | | FK → User, `onDelete: SetNull` |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**
- `stage` (칸반 집계 US-005, 파이프라인 위젯 US-018)
- `(titleOriginal, productionYear)` — **UNIQUE 아님.** 중복 후보 감지용 조회 인덱스일 뿐이다
- `assigneeId`, `productionYear`, `productionCountry` (필터 US-004)
- `genres` — GIN 인덱스 (배열 포함 검색)

> **중복을 UNIQUE로 막지 않는 이유**: US-001의 수용 기준은 *"중복 가능성 경고가 표시되고, 기존 작품으로 이동하거나 **그대로 등록을 진행할 수 있다**"* 이다. 리메이크나 동명이작이 실제로 존재하므로 차단이 아니라 경고여야 한다.

**관계 (전부 `onDelete: Cascade`)**: `FestivalRecord`, `Evaluation`, `Comment`, `StageTransition`, `Deal`(1:1), `RightsGrant`, `FinancialModel`(1:1)

---

## 6. StageTransition — 단계 변경 이력 (스키마만, 동작은 U3)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleId` | String | ✅ | FK → Title, `onDelete: Cascade` |
| `fromStage` | Stage | | **null 허용** — 작품 최초 생성 시 |
| `toStage` | Stage | ✅ | |
| `changedById` | String | | FK → User, `onDelete: SetNull` |
| `occurredAt` | DateTime | ✅ | 요청 시각 (`ctx.now`) |
| `note` | String | | 최대 500자. 변경 사유 |

**인덱스**: `(titleId, occurredAt)` — 이력 시간순 조회, 체류 일수 계산

**append-only의 스키마 수준 반영**

| 층위 | 방법 |
|---|---|
| 타입 | `StageTransitionRepository`에 `update`·`delete` 메서드를 정의하지 않음 → **컴파일 차단** |
| 스키마 | `updatedAt` 필드를 두지 않음 → 수정을 전제하지 않는 테이블임이 스키마에 드러남 |
| 코드 리뷰 | 설계 위반 판정 #5 |

> **DB 권한으로 막지 않는 이유**: 애플리케이션이 단일 DB 사용자로 접속하는 PoC 구성에서 테이블별 권한 분리는 실효가 적다. 타입 수준 차단으로 충분하다.

---

## 7. Deal — 딜 (스키마만, 동작은 U4)

| 필드 | 타입 | 필수 | 제약 | 필드 정책 |
|---|---|---|---|---|
| `id` | String (cuid) | ✅ | PK | 전 역할 |
| `titleId` | String | ✅ | FK → Title, **UNIQUE** (1:1), Cascade | 전 역할 |
| `askingPrice` | BigInt | | ≥ 0 | Analyst·Executive |
| `offerAmount` | BigInt | | ≥ 0 | **전 역할** |
| `offerSubmittedAt` | DateTime | | | 전 역할 |
| `offerExpiryDate` | DateTime | | ≥ `offerSubmittedAt` | **전 역할** |
| `minimumGuarantee` | BigInt | | ≥ 0 | Analyst·Executive |
| `runningRoyaltyRate` | Float | | 0~100 (%) | Analyst·Executive |
| `contractTerms` | String | | 최대 5000자 | Analyst·Executive |
| `createdAt` / `updatedAt` | DateTime | ✅ | | 전 역할 |

**인덱스**: `offerExpiryDate` (마감 임박 위젯 US-020, 알림 스캔 US-024)

> **`offerAmount`와 `offerExpiryDate`만 Scout에게 열린 이유**: 파이프라인 위젯이 단계별 오퍼 금액 합계를 표시하고(US-018), Scout도 이 위젯을 본다. 만료 임박도 담당 작품 관리에 필요하다. 반면 MG·러닝로열티·계약조건은 평가 독립성을 위해 차단한다 (requirements.md 가정 A-1).

---

## 8. FinancialModel — 재무 모델 (스키마만, 동작은 U4)

| 필드 | 타입 | 필수 | 제약 | 필드 정책 |
|---|---|---|---|---|
| `id` | String (cuid) | ✅ | PK | Analyst·Executive |
| `titleId` | String | ✅ | FK → Title, **UNIQUE** (1:1), Cascade | Analyst·Executive |
| `paAndBudget` | BigInt | ✅ | ≥ 0. P&A 예산 | Analyst·Executive |
| `otherCosts` | BigInt | ✅ | ≥ 0. 기본값 0 | Analyst·Executive |
| `expectedRevenue` | BigInt | ✅ | ≥ 0 | Analyst·Executive |
| `createdAt` / `updatedAt` | DateTime | ✅ | | Analyst·Executive |

> **계산 결과는 저장하지 않는다.** 총 인수비용·예상 손익·ROI·손익분기는 `D1`이 조회 시점에 계산한다. 저장하면 입력값과 계산값이 어긋날 수 있고, NFR-008의 "단일 정의"가 DB에 사본을 두는 것으로 깨진다.

> **엔티티 전체가 Scout에게 차단**된다. 개별 필드가 아니라 엔티티 단위로 정책이 걸린다.

---

## 9. RightsGrant — 판권 (스키마만, 동작은 U4)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleId` | String | ✅ | FK → Title, Cascade (1:N — 한 작품에 여러 판권 가능) |
| `territories` | Territory[] | ✅ | 최소 1개 |
| `contractStartDate` | DateTime | ✅ | |
| `contractEndDate` | DateTime | ✅ | **> `contractStartDate`** (같은 날도 거부) |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**: `contractEndDate` (마감 임박, 알림 스캔), `titleId`
**필드 정책**: 전 역할 조회 가능 (금액이 아니므로 마스킹 대상 아님). 변경은 Analyst만.

---

## 10. Evaluation — 평가 (스키마만, 동작은 U2)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleId` | String | ✅ | FK → Title, Cascade |
| `evaluatorId` | String | | FK → User, `onDelete: SetNull` |
| `artistry` | Int | ✅ | 1~5 |
| `commerciality` | Int | ✅ | 1~5 |
| `buzz` | Int | ✅ | 1~5 |
| `targetFit` | Int | ✅ | 1~5 |
| `overallComment` | String | | 최대 5000자 |
| `screeningDate` | DateTime | | |
| `screeningVenue` | String | | 최대 200자 |
| `screeningAttendees` | String | | 최대 500자 |
| `targetAudience` | String | | 최대 500자 |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**: `titleId`
**UNIQUE 제약 없음** — US-009가 *"기존 평가를 덮어쓰지 않고 평가자별로 나란히 보존"* 을 요구하며, 같은 평가자가 재관람 후 복수 평가를 남기는 것도 허용한다.

---

## 11. FestivalRecord — 영화제 이력 (스키마만, 동작은 U2)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleId` | String | ✅ | FK → Title, Cascade |
| `festivalName` | String | ✅ | 1~200자 |
| `year` | Int | ✅ | 1888~(현재연도+10) |
| `section` | FestivalSection | | |
| `isAward` | Boolean | ✅ | 기본값 false. false = 초청, true = 수상 |
| `awardName` | String | | 최대 200자. `isAward=true`일 때만 의미 |
| `criticalResponse` | String | | 최대 2000자 |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**: `(titleId, year)` — 연도 내림차순 표시 (US-003)

---

## 12. Comment — 코멘트 (스키마만, 동작은 U2)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `titleId` | String | ✅ | FK → Title, Cascade |
| `authorId` | String | | FK → User, `onDelete: SetNull` |
| `body` | String | ✅ | 1~5000자 |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**: `(titleId, createdAt)` — 최신순 표시

> **멘션 대상을 별도 테이블에 저장하지 않는다.** 본문에서 파싱해 알림을 생성하며, 알림 레코드가 곧 멘션의 기록이다. 별도 테이블은 US-010~012 어느 수용 기준도 요구하지 않는다.

---

## 13. Notification — 알림 (스키마만, 동작은 U2·U5)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `id` | String (cuid) | ✅ | PK |
| `userId` | String | ✅ | FK → User, Cascade (수신자) |
| `type` | NotificationType | ✅ | |
| `titleId` | String | | FK → Title, Cascade. 관련 작품 |
| `commentId` | String | | 멘션 알림일 때 이동 대상 |
| `marker` | String | ✅ | **중복 방지 키**. 멘션은 `commentId`, 마감은 `D-7` 등 |
| `message` | String | ✅ | 최대 500자 |
| `isRead` | Boolean | ✅ | 기본값 false |
| `createdAt` | DateTime | ✅ | |

**인덱스**
- `(userId, isRead)` — 미확인 수 배지 (US-023)
- `(userId, type, titleId, marker)` — **UNIQUE**. 중복 알림 생성을 DB 수준에서 차단 (US-024)

> **중복 방지를 UNIQUE 제약으로 두는 이유**: 트랜잭션 T7이 "존재 확인 → 생성" 순서로 동작하는데, 스캔이 동시에 두 번 실행되면 두 조회가 모두 "없음"을 반환할 수 있다. UNIQUE 제약이 있으면 두 번째 삽입이 실패하므로 경쟁 상태에서도 중복이 생기지 않는다.

---

## 14. 관계도

```
User ──1:N── Session          (Cascade)
  │
  ├──1:N── Title.assignee      (SetNull)
  ├──1:N── Evaluation.evaluator (SetNull)
  ├──1:N── Comment.author       (SetNull)
  ├──1:N── StageTransition.changedBy (SetNull)
  └──1:N── Notification         (Cascade)

Title ──1:N── FestivalRecord    (Cascade)
  ├──1:N── Evaluation           (Cascade)
  ├──1:N── Comment              (Cascade)
  ├──1:N── StageTransition      (Cascade)
  ├──1:N── RightsGrant          (Cascade)
  ├──1:1── Deal                 (Cascade)
  └──1:1── FinancialModel       (Cascade)
```

**cascade 방향의 원칙**
- **Title 삭제 → 하위 전부 삭제** (US-002의 수용 기준)
- **User 삭제 → 작성물은 보존, 참조만 끊음** (이력 무결성 보호)
- **Session만 User와 함께 삭제** (인증 정보이므로 남길 이유가 없음)

---

## 15. 인덱스 요약

| 테이블 | 인덱스 | 목적 |
|---|---|---|
| User | `email` UNIQUE | 로그인 조회 |
| User | `role` | 마지막 Executive 판정 |
| Session | `userId`, `expiresAt` | 세션 조회·정리 |
| Title | `stage` | 칸반·파이프라인 위젯 |
| Title | `(titleOriginal, productionYear)` | 중복 후보 감지 |
| Title | `assigneeId`, `productionYear`, `productionCountry` | 필터 |
| Title | `genres` GIN | 배열 포함 검색 |
| StageTransition | `(titleId, occurredAt)` | 이력·체류 일수 |
| Deal | `offerExpiryDate` | 마감 임박·알림 |
| RightsGrant | `contractEndDate`, `titleId` | 마감 임박·알림 |
| Evaluation | `titleId` | 작품별 평가 |
| FestivalRecord | `(titleId, year)` | 연도 내림차순 |
| Comment | `(titleId, createdAt)` | 최신순 |
| Notification | `(userId, isRead)` | 미확인 배지 |
| Notification | `(userId, type, titleId, marker)` UNIQUE | 중복 알림 차단 |

> 성능 목표(작품 500건, NFR-001)에 비해 인덱스가 넉넉하다. 이 규모에서는 인덱스 유지 비용이 무시할 수준이고, 필터 조합(US-004)이 다양해 사전 대비가 낫다.
