# Units of Work — Film Acquisition Dashboard

**작성일**: 2026-07-25
**단계**: 🔵 INCEPTION — Units Generation (Part 2)
**분해 규칙**: 기능 컴포넌트 경계 기준 (Q1=A) · 5개 유닛 (Q2=A) · 공유 코드는 첫 유닛에 집중 (Q3=A) · 순차 진행 (Q4=A) · 실행 가능 + 테스트 통과가 완결 기준 (Q6=A)

---

## 1. 유닛의 의미

본 프로젝트는 **단일 Next.js 애플리케이션**으로 배포되므로(NFR-002), 유닛은 독립 배포 서비스가 아니다.

| 용어 | 본 프로젝트에서의 의미 |
|---|---|
| **Service** | 해당 없음 — 독립 배포 단위가 존재하지 않음 |
| **Module** | `src/modules/{name}/` 아래의 논리적 코드 묶음 |
| **Unit of Work** | 개발·검토·승인의 단위. Construction 단계에서 하나씩 완결한다 |

**Construction 단계에서 각 유닛이 거치는 절차**
```
Functional Design (승인)  →  Code Generation 계획 (승인)  →  Code Generation 실행 (승인)
```
유닛당 승인 3회 × 5유닛 = 15회 + Build and Test 1회 = **총 16회**

---

## 2. 유닛 목록

| ID | 유닛 | 스토리 수 | 핵심 산출물 |
|---|---|---|---|
| **U1** | Foundation & Auth | 7 | 공유 기반 전체 + 인증·권한 + 시드 |
| **U2** | Title & Evaluation | 8 | 작품 관리 + 평가·협업 |
| **U3** | Pipeline | 4 | 칸반 보드 + 단계 이력 |
| **U4** | Deal & Financials | 5 | 딜·판권·재무 |
| **U5** | Dashboard & Reports | 8 | 위젯 3종 + 입출력 + 리포트 + 알림 |
| | **합계** | **32** | |

> **크기 편차에 대하여**: 계획 단계에서 "6~7개씩"을 목표로 했으나 실제 배분은 4~8개가 되었다. 스토리 수보다 **기능 응집도**를 우선했기 때문이다. U3(4개)은 수가 적지만 칸반 드래그 상호작용과 PBT 대상인 체류 일수 계산이 들어 있어 실질 작업량은 적지 않고, U5(8개)는 위젯·입출력·리포트·알림이 모두 "이미 만들어진 데이터를 읽어 내보내는" 성격이라 응집도가 높다. 억지로 균등하게 나누면 같은 화면의 기능이 두 유닛에 걸치게 된다.

---

## 3. 유닛 상세

### U1 — Foundation & Auth

**목적**: 이후 모든 유닛이 딛고 설 기반을 만든다. 이 유닛이 끝나면 로그인해서 역할별로 다른 화면을 볼 수 있고, 권한 강제와 시드 데이터가 동작한다.

**포함 컴포넌트**
- 기능: `C1 Auth`, `C8 Foundation`
- 플랫폼: `X1 AuthorizationPolicy`, `X2 SerializationGate`, `X3 ErrorMapper`, `X4 ValidationSchemas`, `X5 RequestContext`, `X6 PersistenceUnit` — **전부**
- 순수 도메인: `D1 FinancialCalculator`, `D2 DwellTimeCalculator`, `D3 DeadlineCalculator`, `D4 CsvSerializer`, `D5 PipelineRules`, `D6 ScoreCalculator` — **전부**

**포함 서비스**: `S1 AuthService`, `S2 UserManagementService`, `S17 BootstrapService`
**포함 리포지토리**: `UserRepository` (+ 나머지 6개 리포지토리의 인터페이스 정의)
**포함 엔티티**: `User` (+ 전 엔티티의 Prisma 스키마 정의)
**담당 스토리**: US-026, US-027, US-028, US-029, US-030, US-031, US-032 (7개)

**왜 공유 코드가 전부 여기에 있는가**
| 코드 | 여기 있어야 하는 이유 |
|---|---|
| `X1` + `X2` + `X5` | 권한 계층이 없으면 U2 이후 어떤 유닛도 US-027의 수용 기준을 만족할 수 없다. 나중에 추가하면 앞선 유닛을 전부 수정해야 한다 |
| `D1` ~ `D6` | 미리 존재하면 나중 유닛이 산식을 급조하지 않는다. 특히 `D1`이 U4보다 먼저 있어야 NFR-008의 단일 정의가 지켜진다 |
| `X6` + Prisma 스키마 전체 | 엔티티 간 관계가 한 번에 정의되어야 마이그레이션이 누적 수정되지 않는다 |

**산출물**
- `src/platform/**` — 횡단 관심사 6종
- `src/domain/**` — 순수 함수 6종 (**import 금지 구역**)
- `src/modules/auth/**` — 로그인, 사용자 관리
- `src/db/schema.prisma` — 전 엔티티 스키마
- `src/db/seed.ts` — 데모 계정 3개 + 예시 작품
- `docker-compose.yml`, `Dockerfile`, `.env.example`
- 테스트: 순수 함수 4개의 **PBT 전체**, 권한 정책·직렬화 게이트 단위 테스트, 로그인·사용자 관리 API 통합 테스트

**완결 기준**
- [ ] `docker compose up` 으로 앱과 DB가 기동되고 시드가 멱등 적재된다 (US-030, US-031)
- [ ] 데모 계정 3개로 로그인되고 역할이 세션에 반영된다 (US-026)
- [ ] 권한 없는 API 직접 호출 시 403, 마스킹 대상 필드가 응답에서 제거된다 (US-027)
- [ ] 마지막 Executive의 역할 변경·삭제가 거부된다 (US-029)
- [ ] PBT 4개 영역(D1·D2·D3·D4)의 17개 속성이 전부 통과한다
- [ ] 금액·날짜 표기가 KRW·`YYYY-MM-DD`·Asia/Seoul로 일관된다 (US-032)

> **주의**: 이 시점에는 `D1`~`D4`를 호출하는 화면이 아직 없다. 그래도 PBT는 여기서 전부 통과해야 한다. 순수 함수는 화면 없이 검증 가능하며, 이것이 이 함수들을 프레임워크 비의존으로 설계한 이유다.

---

### U2 — Title & Evaluation

**목적**: 작품을 등록·검색하고 평가와 코멘트를 남길 수 있게 한다. 이 유닛이 끝나면 시스템에 실제 데이터가 쌓이기 시작한다.

**포함 컴포넌트**: `C2 TitleComponent`, `C4 EvaluationComponent`
**포함 서비스**: `S3 TitleService`, `S4 FestivalRecordService`, `S6 EvaluationService`, `S7 CommentService`, `S15 NotificationService`(멘션 생성 부분)
**포함 리포지토리**: `TitleRepository`, `EvaluationRepository`, `CommentRepository`, `NotificationRepository`
**포함 엔티티**: `Title`, `FestivalRecord`, `Evaluation`, `Comment`, `Notification`
**담당 스토리**: US-001, US-002, US-003, US-004, US-009, US-010, US-011, US-012 (8개)

**U1에서 가져다 쓰는 것**: `X1`~`X6` 전체, `D6 ScoreCalculator`(종합 점수), `D5 PipelineRules`(작품 생성 시 초기 단계)

**산출물**
- `src/modules/titles/**` — 작품 CRUD, 영화제 이력, 검색·필터
- `src/modules/evaluation/**` — 스코어카드, 코멘트, 멘션
- 화면: 작품 목록, 작품 상세, 작품 등록·수정 폼
- 테스트: 서비스 단위 테스트, 작품·평가·코멘트 API 통합 테스트, **권한 분기 테스트**(Analyst·Executive의 수정 차단)

**완결 기준**
- [ ] 작품을 등록·수정·삭제할 수 있고 중복 후보 경고가 뜬다 (US-001, US-002)
- [ ] 필터 조건이 URL에 반영되어 새로고침 후에도 유지된다 (US-004)
- [ ] 평가를 등록하면 종합 점수가 목록에 표시되고, 평가 0건이면 `미평가`로 표시된다 (US-009, US-010)
- [ ] 코멘트에 `@사용자명`을 쓰면 대상자의 알림 센터에 알림이 생긴다 (US-012)
- [ ] Analyst·Executive로는 작품 수정 버튼이 없고 API 호출 시 403 (US-002)
- [ ] 작품 삭제 시 하위 엔티티가 함께 삭제된다 (트랜잭션 T2)

---

### U3 — Pipeline

**목적**: 작품이 인수 단계를 따라 이동하게 하고, 그 궤적을 지울 수 없는 기록으로 남긴다.

**포함 컴포넌트**: `C3 PipelineComponent`
**포함 서비스**: `S5 PipelineService`
**포함 리포지토리**: `StageTransitionRepository`
**포함 엔티티**: `StageTransition` (+ `Title.stage` 갱신)
**담당 스토리**: US-005, US-006, US-007, US-008 (4개)

**U1에서 가져다 쓰는 것**: `D5 PipelineRules`(전환 허용 판정), `D2 DwellTimeCalculator`(체류 일수), `X5`(역할 확인)
**U2에서 가져다 쓰는 것**: `TitleRepository`, 작품 데이터

**산출물**
- `src/modules/pipeline/**` — 보드 조회, 단계 전환, 이력 조회
- 화면: 칸반 보드(드래그 앤 드롭), 작품 상세의 이력 영역
- 테스트: 전환 규칙 단위 테스트, **트랜잭션 T1 검증**(단계 변경 시 이력이 반드시 남는가), 권한 분기 테스트(Executive 드래그 차단)

**완결 기준**
- [ ] 칸반 보드에 7개 열이 표시되고 카드를 끌어 단계를 바꿀 수 있다 (US-005, US-006)
- [ ] Executive로는 드래그가 비활성화되고 API 직접 호출 시 403 (US-007)
- [ ] 단계 변경 시 이전·이후 단계, 변경자, 시각, 사유가 이력에 남는다 (US-006)
- [ ] 이력 화면에 단계별 체류 일수가 표시되고, 총합이 등록 후 경과 일수와 일치한다 (US-008)
- [ ] 종료 단계에서 이전 단계로 되돌리기가 허용된다 (US-006)
- [ ] `StageTransitionRepository`에 수정·삭제 메서드가 존재하지 않는다 (구조적 검증)

---

### U4 — Deal & Financials

**목적**: 딜 조건과 판권을 기록하고 수익성을 계산한다. **이 유닛에서 마스킹이 실제로 동작하는 첫 데이터가 생긴다.**

**포함 컴포넌트**: `C5 DealComponent`
**포함 서비스**: `S8 DealService`, `S9 RightsService`, `S10 FinancialService`
**포함 리포지토리**: `DealRepository`
**포함 엔티티**: `Deal`, `RightsGrant`, `FinancialModel`
**담당 스토리**: US-013, US-014, US-015, US-016, US-017 (5개)

**U1에서 가져다 쓰는 것**: `D1 FinancialCalculator`(**산식을 재구현하지 않고 호출만 한다**), `X1`의 필드 정책, `X2` 직렬화 게이트
**U2에서 가져다 쓰는 것**: `Title` (딜은 작품에 종속)

**산출물**
- `src/modules/deals/**` — 딜·판권·재무 서비스와 화면
- 화면: 작품 상세의 딜 영역, 판권 영역, 재무 영역
- 테스트: 서비스 단위 테스트, **마스킹 통합 테스트**(Scout 응답 페이로드에 MG·재무 키가 없음을 직접 검증), 날짜 순서 검증 테스트

**완결 기준**
- [ ] Analyst가 딜 정보를 등록·수정할 수 있고 금액이 KRW 정수로 보존된다 (US-013)
- [ ] **Scout로 조회 시 응답 페이로드에 `minimumGuarantee`·`runningRoyaltyRate`·`contractTerms`·재무 필드의 키가 아예 없다** (US-014) ← 이 유닛의 핵심 검증
- [ ] Scout의 딜 수정 API 호출이 403으로 거부된다 (US-014)
- [ ] 판권 종료일이 시작일 이전이면 저장이 거부된다 (US-015)
- [ ] 재무 값을 입력하면 총 인수비용·예상 손익·ROI·손익분기가 계산되고, 총 인수비용 0이면 ROI가 `N/A`다 (US-016)
- [ ] Executive는 마스킹 없이 전 필드를 보되 수정은 불가하다 (US-017)
- [ ] 재무 산식이 `src/domain/` 밖에 존재하지 않는다 (설계 위반 판정 #4)

---

### U5 — Dashboard & Reports

**목적**: 앞선 유닛들이 쌓은 데이터를 집계해 보여주고, 밖으로 내보낸다.

**포함 컴포넌트**: `C6 DashboardComponent`, `C7 DataIOComponent`
**포함 서비스**: `S11 DashboardService`, `S12 ImportService`, `S13 ExportService`, `S14 ReportService`, `S15 NotificationService`(조회·읽음), `S16 DeadlineScanService`
**포함 엔티티**: 읽기 전용 집계 (+ `Notification` 확장)
**담당 스토리**: US-018, US-019, US-020, US-021, US-022, US-023, US-024, US-025 (8개)

**U1에서 가져다 쓰는 것**: `D1`(금액 집계), `D2`(병목 단계), `D3`(D-day), `D4`(CSV 직렬화), `X2`(내보내기 마스킹)
**U2~U4에서 가져다 쓰는 것**: 전 엔티티의 데이터

**산출물**
- `src/modules/dashboard/**` — 위젯 3종 집계
- `src/modules/dataio/**` — 가져오기·내보내기·리포트·알림
- 화면: 대시보드, 알림 센터, 가져오기 미리보기, 리포트 생성
- 테스트: 집계 단위 테스트, **CSV 왕복 PBT의 통합 검증**(U1에서 순수 함수 수준으로 통과한 속성이 실제 데이터 경로에서도 성립하는지), 내보내기 마스킹 테스트, 알림 중복 방지 테스트

**완결 기준**
- [ ] 대시보드 위젯 3종이 시드 데이터만으로도 의미 있는 값을 표시한다 (US-018~020, US-031)
- [ ] 파이프라인 위젯의 단계 항목을 클릭하면 필터가 적용된 목록으로 이동한다 (US-018)
- [ ] 포트폴리오 위젯의 집계 기준을 `계약체결`↔`전체`로 전환할 수 있다 (US-019)
- [ ] 마감 임박 위젯이 7/30/90일 범위 전환을 지원하고 만료분을 강조한다 (US-020)
- [ ] CSV 가져오기 시 반영 전 미리보기가 뜨고 오류 행만 제외해 반영할 수 있다 (US-021)
- [ ] **Scout로 내보낸 파일에 MG·재무 컬럼이 없고, Analyst로 내보낸 파일은 다시 가져오면 원본과 동일하다** (US-022)
- [ ] PDF 리포트에서 한글이 깨지지 않고 머리말에 생성 시각·생성자가 있다 (US-025)
- [ ] 오퍼 만료 D-7 알림이 생성되고 재실행 시 중복 생성되지 않는다 (US-024)

---

## 4. 코드 조직 전략 (그린필드)

### 4.1 디렉터리 구조 (Q8=A 기능 우선)

```
<WORKSPACE-ROOT>/
├── docker-compose.yml            # 앱 + PostgreSQL          [U1]
├── Dockerfile                                                [U1]
├── .env.example                                              [U1]
├── package.json  tsconfig.json  next.config.ts               [U1]
├── vitest.config.ts                                          [U1]
│
├── prisma/
│   ├── schema.prisma             # 전 엔티티 10개            [U1]
│   ├── migrations/
│   └── seed.ts                                               [U1]
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # ★ API 경계 (Route Handlers)
│   │   │   ├── auth/                                         [U1]
│   │   │   ├── users/                                        [U1]
│   │   │   ├── titles/                                       [U2]
│   │   │   ├── evaluations/  comments/                       [U2]
│   │   │   ├── pipeline/                                     [U3]
│   │   │   ├── deals/  rights/  financials/                  [U4]
│   │   │   ├── dashboard/                                    [U5]
│   │   │   └── import/  export/  reports/  notifications/    [U5]
│   │   └── (pages)/              # 화면
│   │
│   ├── domain/                   # ★ 순수 함수 — import 금지 구역  [U1]
│   │   ├── financials.ts         # D1  [PBT]
│   │   ├── dwell-time.ts         # D2  [PBT]
│   │   ├── deadline.ts           # D3  [PBT]
│   │   ├── csv.ts                # D4  [PBT]
│   │   ├── pipeline-rules.ts     # D5
│   │   └── score.ts              # D6
│   │
│   ├── platform/                 # ★ 횡단 관심사                   [U1]
│   │   ├── authz/policy.ts       # X1 필드 정책 테이블
│   │   ├── authz/serialize.ts    # X2 단일 직렬화 게이트
│   │   ├── errors/               # X3 도메인 오류 + HTTP 매핑
│   │   ├── validation/           # X4 Zod 스키마
│   │   ├── context/              # X5 RequestContext
│   │   └── db/                   # X6 Prisma 클라이언트 + 트랜잭션
│   │
│   ├── modules/                  # ★ 기능별 모듈
│   │   ├── auth/                 # 서비스 · 리포지토리 · UI        [U1]
│   │   ├── titles/                                                [U2]
│   │   ├── evaluation/                                            [U2]
│   │   ├── pipeline/                                              [U3]
│   │   ├── deals/                                                 [U4]
│   │   ├── dashboard/                                             [U5]
│   │   └── dataio/                                                [U5]
│   │
│   └── shared/                   # UI 공용 컴포넌트 · 포맷 유틸    [U1]
│
└── tests/
    ├── property/                 # PBT 4종                        [U1]
    ├── unit/
    └── integration/
```

### 4.2 모듈 내부 구조

각 `src/modules/{name}/` 은 동일한 내부 구조를 가진다.

```
modules/{name}/
├── service.ts          # 애플리케이션 서비스 (ctx를 첫 인자로 받음)
├── repository.ts       # 리포지토리 인터페이스 + Prisma 구현체
├── schema.ts           # 이 모듈의 Zod 스키마 (platform/validation 재사용)
├── types.ts            # 모듈 내부 타입
└── components/         # 이 모듈 전용 React 컴포넌트
```

### 4.3 경계 강제 수준 (Q9=A)

디렉터리로 분리하되 **lint 규칙으로 강제하지 않는다.** 위반은 코드 리뷰에서 아래 기준으로 확인한다.

| # | 위반 | 확인 방법 |
|---|---|---|
| 1 | `src/domain/**` 에 `import` 문 존재 | 해당 디렉터리 전체 검색 |
| 2 | `src/modules/**/repository.ts` 밖에서 `@prisma/client` import | 프로젝트 검색 |
| 3 | `X2` 직렬화 게이트를 거치지 않은 응답 | Route Handler 반환 경로 점검 |
| 4 | 재무 산식이 `src/domain/financials.ts` 밖에 존재 | ROI·손익분기 계산식 검색 |
| 5 | `StageTransition` 수정·삭제 | 메서드 부재로 컴파일 차단 |
| 6 | 서비스 메서드가 `role`을 인자로 받음 | 시그니처 점검 |
| 7 | 모듈 간 직접 import (허용 경로 외) | `modules/` 간 import 검색 |

> **허용된 모듈 간 import는 하나뿐이다**: `modules/evaluation` → `modules/dataio`(알림 생성). 그 외 모듈 간 직접 참조는 위반이다.

### 4.4 코드 위치 규칙 (재확인)

| 대상 | 위치 |
|---|---|
| 애플리케이션 코드 | **워크스페이스 루트** (`aidlc-docs/` 안이 아님) |
| 설계 문서 | `aidlc-docs/` 만 |
| 유닛별 설계 산출물 | `aidlc-docs/construction/{unit-name}/` |

---

## 5. 유닛별 요약표

| | U1 Foundation & Auth | U2 Title & Evaluation | U3 Pipeline | U4 Deal & Financials | U5 Dashboard & Reports |
|---|---|---|---|---|---|
| **스토리 수** | 7 | 8 | 4 | 5 | 8 |
| **컴포넌트** | C1, C8, X1~X6, D1~D6 | C2, C4 | C3 | C5 | C6, C7 |
| **서비스** | S1, S2, S17 | S3, S4, S6, S7, S15* | S5 | S8, S9, S10 | S11~S16 |
| **신규 엔티티** | User (+ 전체 스키마) | Title, FestivalRecord, Evaluation, Comment, Notification | StageTransition | Deal, RightsGrant, FinancialModel | — (집계만) |
| **PBT** | D1·D2·D3·D4 전 속성 | — | (D2 활용) | (D1 활용) | (D4 왕복 통합 검증) |
| **권한 분기 스토리** | US-027 | US-002, US-009 | US-006, US-007 | US-013~017 | US-021, US-022, US-025 |
| **트랜잭션** | T6 | T2, T3, T4 | T1 | — | T5, T7 |
| **핵심 검증** | 권한 강제 + PBT 통과 | 데이터 생성 + 멘션 알림 | 이력 무결성 | **마스킹 실동작** | 집계 + 내보내기 마스킹 |

\* S15는 U2에서 생성 기능만, U5에서 조회·읽음 기능을 완성한다.
