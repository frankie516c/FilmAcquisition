# Domain Entities — U5 Dashboard & Reports

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U5 Functional Design

> ⚠️ **as-built 기록입니다.** U5의 Functional Design 단계는 실행되지 않았고, 아래 결정은
> 구현 중에 내려졌습니다.

---

## 1. U5는 새 엔티티를 거의 만들지 않는다

이 유닛은 **앞선 유닛이 쌓은 데이터를 읽어 집계하고 내보내는** 성격입니다.

| 엔티티 | U5의 관계 |
|---|---|
| `Notification` | **소유** — 조회·읽음 처리·마감 알림 생성 |
| `Title`·`Deal`·`RightsGrant`·`StageTransition`·`Evaluation` | **읽기 전용** 집계 대상 |
| CSV 가져오기로 생성되는 `Title`·`StageTransition` | U2의 규칙을 그대로 따름 |

**집계 결과를 저장하는 테이블이 없습니다.** 위젯·리포트는 매 요청 계산합니다.

---

## 2. `Notification` — U5가 소유

### 2.1 중복 방지를 DB 제약으로 둔다

```
@@unique([userId, dedupeKey])     ← 두 컬럼 모두 NOT NULL
```

**애플리케이션 검사만으로 부족한 이유**: 마감 스캔이 동시에 두 번 실행되면 두 조회가 모두
"없음"을 반환한 뒤 둘 다 삽입할 수 있습니다. 트랜잭션(T7)으로 묶어도 격리 수준에 따라
막히지 않습니다.

UNIQUE 제약이 있으면 두 번째 삽입이 `P2002`로 실패하고, 코드가 이를 잡아 `skipped`로
처리합니다. **경쟁 상태에서도 중복이 생기지 않습니다.**

**검증됨**: 스캔 3회 연속 → `{created:1}` → `{created:0, skipped:1}` → `{created:0, skipped:1}`
(`tests/integration/notification-dedupe.test.ts`가 자동 검증)

### 2.2 `dedupeKey` — 중복 판정의 단일 근거 (2026-07-26 도입)

#### 왜 바꿨는가

**이전 제약**: `@@unique([userId, type, titleId, marker])`

PostgreSQL에서 `NULL`은 서로 같지 않습니다. 따라서 `titleId`가 `NULL`인 행은
**이 제약이 걸리지 않습니다.** 같은 `(userId, type, marker)` 조합이라도 무제한으로
삽입됩니다.

당시에는 세 유형 모두 작품에 연결되어 증상이 없었지만, **작품과 무관한 알림(시스템 공지 등)이
추가되는 순간 중복 방지가 조용히 무력화되는 구조**였습니다. 발현되기 전에 고쳤습니다.

#### 새 구조

중복 판정의 근거를 **NOT NULL 단일 컬럼**으로 명시했습니다. 네 컬럼의 암묵적 조합이 아니라
하나의 값이 "이 알림의 정체성"을 나타냅니다.

| 알림 유형 | `dedupeKey` | 생성 함수 |
|---|---|---|
| `MENTION` | `mention:{commentId}` | `mentionKey()` |
| `OFFER_EXPIRY` | `offer_expiry:{titleId}:D-7` | `deadlineKey()` |
| `RIGHTS_EXPIRY` | `rights_expiry:{titleId}:D-30` | 〃 |
| (미래) 시스템 공지 | `system:-:{topic}` | `systemKey()` |

작품이 없으면 `-` 자리표시자가 들어갑니다. **`null`이나 빈 문자열이 아닌 명시적 기호**입니다.

생성 규칙은 `src/domain/notification-key.ts`에 순수 함수로 있습니다.

#### `marker`는 남았습니다

`marker`는 이제 **화면 표시용**입니다(`D-7` 같은 라벨). 중복 판정에는 관여하지 않습니다.
두 역할을 한 컬럼이 겸하던 것을 분리했습니다.

#### 검증

| 층위 | 방식 |
|---|---|
| 순수 함수 | `tests/unit/notification-key.test.ts` 9건 — `null`과 `undefined`가 같은 키로 수렴하는지 포함 |
| DB 제약 | `titleId`가 `NULL`인 행 2건을 같은 키로 직접 INSERT → **UNIQUE 위반으로 거부됨** 확인 |
| 통합 | 스캔 반복 시 알림 총수 불변 확인 |

> DB에 직접 INSERT해 확인한 것이 중요합니다. 애플리케이션 코드는 항상 `titleId`를 넣으므로
> 코드를 통해서는 이 경로를 재현할 수 없습니다.

### 2.3 `titleId`는 여전히 nullable

작품과 무관한 알림이 생길 여지를 남겼습니다. **이제는 nullable이어도 안전합니다** —
중복 판정이 `dedupeKey`로 옮겨졌기 때문입니다.

### 2.4 `isRead` — 사용자별 상태

읽음은 알림 자체의 속성입니다. 알림이 사용자 하나에 귀속되므로(1:N) 별도 읽음 테이블이
필요 없습니다.

### 2.5 cascade

```
User 삭제   → Notification Cascade   (수신자가 없으면 알림도 무의미)
Title 삭제  → Notification Cascade
Comment 삭제 → Notification Cascade   (멘션 알림)
```

`User`가 `SetNull`이 아니라 `Cascade`인 유일한 관계입니다. 다른 곳(평가·코멘트·이력)은
사람이 떠나도 기록이 남지만, **알림은 받을 사람이 없으면 존재 이유가 없습니다.**

---

## 3. 집계 대상 — 읽기 전용

### 3.1 파이프라인 현황

| 필요 데이터 | 출처 |
|---|---|
| 단계별 작품 수 | `Title.stage` |
| 단계별 오퍼 금액 합계 | `Deal.offerAmount` |
| 병목 단계 | `StageTransition` 전체 → D2 계산 |

### 3.2 포트폴리오 구성

| 필요 데이터 | 출처 |
|---|---|
| 장르 분포 | `Title.genres` (배열) |
| 국가 분포 | `Title.productionCountry` |
| 라인업 갭 | 주요 장르 6종 중 0건인 것 |

**주요 장르 6종을 코드 상수로 둡니다** (`MAJOR_GENRES`). 12종 전부를 갭 판정 대상으로 하면
공포·판타지·전쟁까지 "갭"으로 나와 의미가 희석됩니다.

### 3.3 마감 임박

| 필요 데이터 | 출처 |
|---|---|
| 오퍼 만료 | `Deal.offerExpiryDate` |
| 판권 만료 | `RightsGrant.contractEndDate` |

두 유형을 한 목록에 섞어 마감일 오름차순으로 보여줍니다.

---

## 4. CSV 가져오기로 만들어지는 데이터

`Title`과 `StageTransition`을 생성하며, **U2의 규칙(T3)을 그대로 따릅니다.**

| 항목 | 값 |
|---|---|
| `stage` | `DISCOVERY` |
| `assigneeId` | 가져오기 실행자 |
| `createdAt` | `ctx.now` |
| 최초 이력 `note` | `CSV 가져오기` |

**가져오기 전용 필드나 표식을 두지 않습니다.** 개별 등록과 구분되는 것은 이력의 `note`뿐이며,
그것으로 충분합니다.

**가져오기 컬럼은 내보내기보다 좁습니다.**

| 구분 | 컬럼 |
|---|---|
| 가져오기 (6개) | 제목·원제·감독·제작연도·장르·시놉시스 |
| 내보내기 (최대 17개) | 위 + 단계·담당자·점수·딜 7종·재무 4종 |

**계산값과 마스킹 대상은 입력받지 않습니다.** ROI를 CSV로 입력받으면 산식의 단일 정의가
무너지고, MG를 입력받으면 Scout가 가져오기로 마스킹을 우회할 수 있습니다.
