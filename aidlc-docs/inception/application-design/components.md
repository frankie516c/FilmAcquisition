# Components — Film Acquisition Dashboard

**작성일**: 2026-07-25
**단계**: 🔵 INCEPTION — Application Design
**설계 원칙**: 3계층 + 순수 도메인 모듈 (Q1=A) · 기능 영역 기준 경계 (Q5=A)

---

## 1. 컴포넌트 분류

컴포넌트는 세 종류로 나뉜다. **의존 방향은 항상 바깥 → 안쪽 한 방향이다.**

```
[ 기능 컴포넌트 ]  8개 — 사용자 기능을 담당. 기능 영역(에픽) 단위
        |
        v
[ 플랫폼 컴포넌트 ] 6개 — 횡단 관심사. 권한·직렬화·검증·오류·컨텍스트·영속성
        |
        v
[ 순수 도메인 모듈 ] 6개 — 계산과 규칙. 어떤 것에도 의존하지 않음
```

**의존 규칙**
- 기능 컴포넌트 → 플랫폼 컴포넌트 → (없음)
- 기능 컴포넌트 → 순수 도메인 모듈
- 순수 도메인 모듈은 **아무것도 import 하지 않는다** (프레임워크·DB·HTTP·Prisma 타입 전부 금지)
- 기능 컴포넌트 간 직접 의존은 원칙적으로 금지. 필요한 경우 `component-dependency.md`에 명시된 경로만 허용

---

## 2. 기능 컴포넌트 (Feature Components)

### C1. AuthComponent — 인증 및 권한
**목적**: 로그인, 세션, 사용자 계정 관리, 역할 부여

**책임**
- 이메일·비밀번호 인증 및 세션 발급·만료
- 비밀번호 해시 생성·검증
- 사용자 계정 CRUD 및 역할 지정
- 마지막 Executive 보호 규칙 집행

**책임 아님**
- 권한 정책의 정의와 필드 마스킹 판정 → `X1 AuthorizationPolicy`, `X2 SerializationGate`
- 요청별 현재 사용자 컨텍스트 보관 → `X5 RequestContext`

**담당 스토리**: US-026, US-028, US-029
**주요 엔티티**: `User`

---

### C2. TitleComponent — 작품 관리
**목적**: 작품 마스터와 영화제·수상 이력의 등록·조회·수정·삭제

**책임**
- 작품 CRUD 및 중복 후보 감지(원제 + 제작연도)
- 영화제·수상 이력 다건 관리
- 작품 검색 및 다중 조건 필터, 필터 상태의 쿼리 표현
- 작품 삭제 시 하위 엔티티 cascade 조정

**책임 아님**
- 파이프라인 단계 값의 전환 → `C3 PipelineComponent`
- 평가 점수 산출 → `C4 EvaluationComponent`

**담당 스토리**: US-001, US-002, US-003, US-004
**주요 엔티티**: `Title`, `FestivalRecord`

---

### C3. PipelineComponent — 인수 파이프라인
**목적**: 7단계 파이프라인의 상태 전환과 변경 이력 관리

**책임**
- 칸반 보드용 단계별 작품 집계 제공
- 단계 전환 실행 (전환 + 이력 기록을 단일 트랜잭션으로)
- 단계 변경 이력 조회 및 체류 기간 산출 위임
- append-only 규칙 준수 보장 (이력 수정·삭제 경로 미제공)

**책임 아님**
- 체류 일수 계산 자체 → `D2 DwellTimeCalculator`
- 단계 목록·전환 허용 규칙 정의 → `D5 PipelineRules`

**담당 스토리**: US-005, US-006, US-007, US-008
**주요 엔티티**: `Title.stage`, `StageTransition`

---

### C4. EvaluationComponent — 평가 및 협업
**목적**: 평가 스코어카드, 코멘트, 멘션

**책임**
- 평가 등록·조회 (평가자별 복수 평가 보존)
- 종합 점수 산출 위임 및 노출
- 코멘트 CRUD (본인 작성분만 수정·삭제)
- 코멘트 본문에서 멘션 대상 추출 및 알림 요청

**책임 아님**
- 알림 레코드 생성·조회 → `C7 DataIOComponent`의 NotificationService
- 점수 평균 계산 → `D6 ScoreCalculator`

**담당 스토리**: US-009, US-010, US-011, US-012
**주요 엔티티**: `Evaluation`, `Comment`

---

### C5. DealComponent — 딜 · 판권 · 재무
**목적**: 딜 조건, 판권 영토·기간, 재무 입력과 계산 결과 관리

**책임**
- 딜 정보 CRUD (요청가, 오퍼 금액, 제출일, 유효기간, MG, 러닝 로열티율, 계약 조건)
- 판권 CRUD (영토 다중, 계약 시작일·종료일)
- 재무 입력값 저장 및 계산 결과 제공
- 금액의 KRW 정수 보존 (부동소수점 사용 금지)

**책임 아님**
- 재무 산식 자체 → `D1 FinancialCalculator` (**이 컴포넌트는 산식을 구현하지 않고 호출만 한다**)
- 역할별 필드 제거 → `X2 SerializationGate`
- 판권 충돌 검증 → 범위 밖 (requirements.md 4.2절)

**담당 스토리**: US-013, US-014, US-015, US-016, US-017
**주요 엔티티**: `Deal`, `RightsGrant`, `FinancialModel`

---

### C6. DashboardComponent — 대시보드
**목적**: 파이프라인 현황·포트폴리오 구성·마감 임박 세 위젯의 집계 데이터 제공

**책임**
- 단계별 작품 수·오퍼 금액 합계·병목 단계 산출
- 장르·국가·등급별 분포 및 라인업 갭 산출, 집계 기준 전환(계약체결 / 전체)
- 마감 임박 항목 조회 및 기간 범위 전환(7/30/90일)

**책임 아님**
- D-day 계산 → `D3 DeadlineCalculator`
- 위젯 렌더링 → UI 계층 (Code Generation)

**담당 스토리**: US-018, US-019, US-020
**주요 엔티티**: 읽기 전용 집계 (`Title`, `StageTransition`, `Deal`, `RightsGrant`)

---

### C7. DataIOComponent — 데이터 입출력 · 리포트 · 알림
**목적**: CSV/Excel 가져오기·내보내기, PDF/Excel 리포트, 알림 센터와 마감 알림 생성

**책임**
- CSV 템플릿 제공, 업로드 파싱, 검증 미리보기, 부분 반영
- 필터 조건 기준 내보내기 (역할별 마스킹 적용)
- 리포트 3종 생성 (파이프라인 요약 / 포트폴리오 요약 / 작품 상세 시트)
- 알림 조회·읽음 처리, 마감 알림 스캔 및 중복 방지

**책임 아님**
- CSV 직렬화·역직렬화 규칙 → `D4 CsvSerializer`
- 마스킹 판정 → `X2 SerializationGate` (내보내기·리포트도 이 게이트를 통과한다)

**담당 스토리**: US-012(알림 생성 수신), US-021, US-022, US-023, US-024, US-025
**주요 엔티티**: `Notification`, 읽기 전용 전 엔티티

---

### C8. FoundationComponent — 실행 기반
**목적**: 애플리케이션 부트스트랩, 시드 데이터, 표기 규약

**책임**
- 기동 시 마이그레이션 적용 확인 및 시드 멱등 적재
- 데모 계정 3개(Scout / Analyst / Executive) 및 예시 작품 생성
- 시드 데이터가 대시보드 위젯 3종을 모두 채우도록 구성 (7일 이내 만료 오퍼 최소 1건 포함)
- KRW 금액 포맷, `YYYY-MM-DD` 날짜 포맷, `Asia/Seoul` 시간대 규약 제공
- 비밀 정보의 환경변수 주입 확인

**담당 스토리**: US-030, US-031, US-032

---

## 3. 플랫폼 컴포넌트 (Platform Components — 횡단 관심사)

### X1. AuthorizationPolicy — 권한 정책 테이블
**목적**: "누가 무엇을 할 수 있고 어떤 필드를 볼 수 있는가"를 **선언적 단일 지점**으로 보관

**책임**
- **동작 정책**: `{리소스, 액션} → 허용 역할 집합` (권한 매트릭스 12항목)
- **필드 정책**: `{엔티티.필드} → 조회 가능 역할 집합`
- 정책 조회 API 제공 (판정만 하고 데이터를 다루지 않음)

**핵심 규칙**
> **정책에 선언되지 않은 필드의 기본값은 "차단"이다.** 새 필드를 추가하고 정책 등록을 잊으면 노출이 아니라 누락으로 나타나므로, 실수가 데이터 유출로 이어지지 않는다.

**필드 정책 초기값** (requirements.md 3.2절 기준)

| 엔티티.필드 | Scout | Analyst | Executive |
|---|---|---|---|
| `Deal.offerAmount` | ✅ | ✅ | ✅ |
| `Deal.offerExpiryDate` | ✅ | ✅ | ✅ |
| `Deal.askingPrice` | ❌ | ✅ | ✅ |
| `Deal.minimumGuarantee` | ❌ | ✅ | ✅ |
| `Deal.runningRoyaltyRate` | ❌ | ✅ | ✅ |
| `Deal.contractTerms` | ❌ | ✅ | ✅ |
| `FinancialModel.*` (전 필드) | ❌ | ✅ | ✅ |
| 그 외 전 엔티티 필드 | ✅ | ✅ | ✅ |

---

### X2. SerializationGate — 단일 직렬화 게이트
**목적**: 시스템 밖으로 나가는 **모든** 데이터가 반드시 통과하는 단일 지점

**책임**
- `X1`의 필드 정책과 요청자 역할에 따라 응답 객체에서 **키 자체를 제거**
- 값을 `null`이나 빈 문자열로 바꾸지 않는다 — 키가 존재하면 안 된다
- 네 경로 전부에 동일 적용: **HTTP 응답 · CSV 내보내기 · PDF 리포트 · Excel 리포트**

**핵심 규칙**
> 어떤 컴포넌트도 이 게이트를 우회해 데이터를 반환할 수 없다. 직렬화되지 않은 도메인 객체를 API 경계 밖으로 내보내는 것은 설계 위반이다.

---

### X3. ErrorMapper — 오류 매핑
**목적**: 도메인 오류를 HTTP 응답으로 변환하는 단일 지점

**책임**
- 도메인 오류 타입 정의: `ValidationError` / `NotFoundError` / `ForbiddenError` / `ConflictError` / `AuthenticationError`
- HTTP 상태코드 매핑: 400 / 404 / 403 / 409 / 401
- 응답 본문 형식 통일
- **정보 노출 통제** — `AuthenticationError`는 원인(계정 없음 / 비밀번호 불일치)에 관계없이 동일 메시지를 반환한다 (US-026)

---

### X4. ValidationSchemas — 검증 스키마
**목적**: 입력 검증 규칙의 단일 정의. 서버 API 경계와 클라이언트 폼이 같은 스키마를 공유

**책임**
- 엔티티별 생성·수정 스키마 정의 (Zod)
- 필수값(FR-001), 점수 범위 1~5(FR-008), 날짜 순서(FR-011·FR-012), 금액 비음수 정수 규칙
- 검증 실패를 `ValidationError`로 변환

---

### X5. RequestContext — 요청 컨텍스트
**목적**: 요청 단위로 현재 사용자와 역할을 보관해 하위 계층에 전달

**책임**
- 세션에서 사용자·역할 확인
- 미인증 요청 차단 (`AuthenticationError`)
- `X1`·`X2`가 판정에 사용할 역할 제공

**핵심 규칙**
> 서비스 메서드는 역할을 인자로 받지 않고 이 컨텍스트에서 읽는다. 호출부가 역할을 위조해 전달할 수 없게 하기 위함이다.

---

### X6. PersistenceUnit — 영속성 및 트랜잭션
**목적**: Prisma 클라이언트 보유와 트랜잭션 경계 제공

**책임**
- Prisma 클라이언트 인스턴스 관리
- `runInTransaction(work)` 형태의 트랜잭션 경계 제공
- 리포지토리 구현체가 사용할 저수준 접근 제공

**핵심 규칙**
> 애플리케이션 서비스는 Prisma 타입을 직접 import 하지 않는다. 리포지토리 인터페이스만 알고, 트랜잭션은 이 컴포넌트가 제공하는 경계로만 연다.

---

## 4. 순수 도메인 모듈 (Pure Domain Modules)

**공통 제약**: 이 모듈들은 **아무것도 import 하지 않는다.** DB·HTTP·프레임워크·Prisma 타입·전역 시각(`new Date()` 직접 호출)에 의존하지 않으며, 필요한 값은 전부 인자로 받는다. 이것이 PBT를 가능하게 하는 조건이다.

### D1. FinancialCalculator `[PBT]`
**목적**: 재무 산식의 **유일한 정의 지점** (NFR-008)

**계산 항목**: 총 인수비용 / 예상 손익 / ROI(%) / 손익분기 매출
**핵심 규칙**: 총 인수비용이 0이면 ROI는 `N/A`를 반환한다 (0으로 나누지 않는다)

> 화면·리포트·내보내기가 모두 이 모듈을 호출한다. 다른 어느 곳에도 같은 산식을 두지 않는다.

### D2. DwellTimeCalculator `[PBT]`
**목적**: 단계 변경 이력으로부터 단계별 체류 일수와 현재 단계 경과 일수를 산출

### D3. DeadlineCalculator `[PBT]`
**목적**: 기준일과 만료일로부터 D-day를 산출하고 임박·만료 여부를 판정
**핵심 규칙**: 시간대는 `Asia/Seoul` 고정. 기준일은 인자로 받는다

### D4. CsvSerializer `[PBT]`
**목적**: 작품 데이터의 CSV 직렬화·역직렬화
**핵심 규칙**: 한글·쉼표·줄바꿈·따옴표가 포함된 값도 왕복 무손실이어야 한다 (US-022)

### D5. PipelineRules
**목적**: 7단계 정의와 전환 허용 판정
**핵심 규칙**: 종료 상태(`계약체결`, `반려`)에서 이전 단계로의 되돌리기를 허용한다 (오기입 정정)

### D6. ScoreCalculator
**목적**: 평가 항목 점수로부터 종합 점수 산출
**핵심 규칙**: 평가가 0건이면 `미평가`를 반환한다 (0점으로 계산하지 않는다)

---

## 5. 리포지토리 (Repository Interfaces)

리포지토리는 인터페이스로 정의되고 Prisma 구현체가 이를 만족한다 (Q4=A). 서비스는 인터페이스만 안다.

| 리포지토리 | 담당 엔티티 | 특기사항 |
|---|---|---|
| `UserRepository` | `User` | Executive 수 조회 기능 포함 (US-029) |
| `TitleRepository` | `Title`, `FestivalRecord` | 필터 조건 조합 조회, 원제+연도 중복 조회 |
| `StageTransitionRepository` | `StageTransition` | **append 및 조회만 제공. update·delete 메서드가 존재하지 않는다** (FR-006) |
| `EvaluationRepository` | `Evaluation` | 작품별 다건 조회 |
| `CommentRepository` | `Comment` | 작성자 확인용 조회 포함 |
| `DealRepository` | `Deal`, `RightsGrant`, `FinancialModel` | 만료 예정 조회 지원 |
| `NotificationRepository` | `Notification` | 중복 알림 존재 여부 조회 (US-024) |

> `StageTransitionRepository`에 수정·삭제 메서드를 두지 않는 것이 append-only의 **구조적 강제**다. 서비스가 실수로 호출할 수단 자체를 없앤다.

---

## 6. 컴포넌트 ↔ 스토리 매핑

| 컴포넌트 | 담당 스토리 | 건수 |
|---|---|---|
| C1 AuthComponent | US-026, US-028, US-029 | 3 |
| C2 TitleComponent | US-001 ~ US-004 | 4 |
| C3 PipelineComponent | US-005 ~ US-008 | 4 |
| C4 EvaluationComponent | US-009 ~ US-012 | 4 |
| C5 DealComponent | US-013 ~ US-017 | 5 |
| C6 DashboardComponent | US-018 ~ US-020 | 3 |
| C7 DataIOComponent | US-021 ~ US-025 | 5 |
| C8 FoundationComponent | US-030 ~ US-032 | 3 |
| X1 + X2 + X5 (권한·마스킹) | US-002, US-007, US-014, US-017, US-022, US-027 (횡단) | 6 (중복 집계) |
| X3 ErrorMapper | US-026 (동일 메시지 규칙) 외 전 스토리의 오류 경로 | 횡단 |
| X4 ValidationSchemas | US-001, US-009, US-013, US-015 외 입력 스토리 전체 | 횡단 |

**검증**: US-001 ~ US-032 **32개 스토리 전부가 최소 1개 기능 컴포넌트에 배정됨. 누락 없음.**
(US-027은 기능 컴포넌트가 아닌 플랫폼 컴포넌트 X1·X2·X5의 조합으로 실현된다.)

---

## 7. 핵심 설계 문제 ↔ 담당 컴포넌트

| # | 핵심 문제 | 담당 |
|---|---|---|
| 1 | 역할별 응답 필드 제거 | `X1 AuthorizationPolicy` + `X2 SerializationGate` + `X5 RequestContext` |
| 2 | 재무 계산식 단일 정의 | `D1 FinancialCalculator` (유일 정의, C5·C6·C7이 호출) |
| 3 | 이력 append-only | `StageTransitionRepository` (수정·삭제 메서드 부재) + `C3` 트랜잭션 |
| 4 | 네 경로 동일 마스킹 | `X2 SerializationGate` (HTTP·CSV·PDF·Excel 공통 통과) |
| 5 | 순수 함수의 프레임워크 비의존 | `D1` ~ `D6` (import 금지 제약) |
