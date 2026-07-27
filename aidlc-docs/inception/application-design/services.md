# Services — Film Acquisition Dashboard

**작성일**: 2026-07-25
**단계**: 🔵 INCEPTION — Application Design

애플리케이션 서비스 계층의 정의, 오케스트레이션 패턴, 트랜잭션 경계, 권한 검증 적용 지점을 기술한다.

---

## 1. 서비스 계층의 위치와 책임

```
HTTP 요청
   |
   v
[ API 경계 ]  Route Handler
   |  1. RequestContext 확립 (X5) — 미인증이면 여기서 401
   |  2. 입력 검증 (X4)          — 실패하면 여기서 400
   |  3. 서비스 호출
   |  4. 응답 직렬화 (X2)        — 역할별 필드 제거
   |  5. 오류 매핑 (X3)          — 도메인 오류 → HTTP
   v
[ 애플리케이션 서비스 ]
   |  1. 동작 권한 확인 (X1)     — 불허면 ForbiddenError
   |  2. 트랜잭션 경계 결정 (X6)
   |  3. 리포지토리 호출 + 도메인 모듈 호출로 흐름 구성
   v
[ 리포지토리 ]  ←→  [ 순수 도메인 모듈 ]
   |                        (서비스가 값을 넘기고 결과를 받는다)
   v
PostgreSQL
```

**서비스 계층이 하는 일**
- 여러 리포지토리·도메인 모듈을 조합해 하나의 사용자 목표를 완결시킨다
- 트랜잭션 경계를 정한다
- 동작 권한(action-level)을 확인한다

**서비스 계층이 하지 않는 일**
- 계산·판정 로직 구현 (→ 순수 도메인 모듈)
- 필드 마스킹 (→ `X2 SerializationGate`, API 경계에서 수행)
- HTTP 상태코드 결정 (→ `X3 ErrorMapper`)
- Prisma 직접 호출 (→ 리포지토리 인터페이스만 사용)

---

## 2. 서비스 목록

| # | 서비스 | 소속 컴포넌트 | 책임 |
|---|---|---|---|
| S1 | `AuthService` | C1 | 로그인·로그아웃·현재 사용자 |
| S2 | `UserManagementService` | C1 | 계정 CRUD, 역할 지정, 마지막 관리자 보호 |
| S3 | `TitleService` | C2 | 작품 CRUD, 중복 감지, 검색·필터 |
| S4 | `FestivalRecordService` | C2 | 영화제·수상 이력 관리 |
| S5 | `PipelineService` | C3 | 보드 조회, 단계 전환 + 이력, 이력 조회 |
| S6 | `EvaluationService` | C4 | 평가 등록·조회, 종합 점수 |
| S7 | `CommentService` | C4 | 코멘트 CRUD, 멘션 추출 |
| S8 | `DealService` | C5 | 딜 정보 관리 |
| S9 | `RightsService` | C5 | 판권 영토·기간 관리 |
| S10 | `FinancialService` | C5 | 재무 입력 저장, 계산 결과 제공 |
| S11 | `DashboardService` | C6 | 위젯 3종 집계 |
| S12 | `ImportService` | C7 | CSV 템플릿·미리보기·반영 |
| S13 | `ExportService` | C7 | 필터 기준 내보내기 |
| S14 | `ReportService` | C7 | PDF·Excel 리포트 생성 |
| S15 | `NotificationService` | C7 | 알림 조회·읽음·생성 |
| S16 | `DeadlineScanService` | C7 | 마감 알림 스캔 (시스템 실행) |
| S17 | `BootstrapService` | C8 | 마이그레이션 확인, 시드 적재, 환경변수 검증 |

---

## 3. 권한 검증 적용 지점

권한은 **두 층위**에서 확인되며, 두 층위의 성격이 다르다.

| 층위 | 확인 대상 | 위치 | 실패 시 |
|---|---|---|---|
| **동작 권한** (action-level) | "이 역할이 이 작업을 할 수 있는가" | 서비스 메서드 진입 시점 | `ForbiddenError` → 403 |
| **필드 권한** (field-level) | "이 역할이 이 필드를 볼 수 있는가" | API 경계의 직렬화 시점 | 필드 키 제거 (오류 아님) |

### 3.1 동작 권한 확인 패턴

모든 변경 계열 서비스 메서드는 **첫 문장에서** 권한을 확인한다.

```ts
async changeStage(ctx: Ctx, titleId: string, toStage: Stage, note?: string) {
  requireRole(ctx, 'SCOUT', 'ANALYST')      // ← 진입 즉시. Executive는 여기서 차단
  ...
}
```

**핵심 규칙**
> 역할은 `ctx`에서만 읽는다. 서비스 메서드는 역할을 인자로 받지 않으므로 호출부가 역할을 위조해 전달할 수 없다.

### 3.2 동작 권한 매핑 (권한 매트릭스 12항목)

| 권한 항목 | 허용 역할 | 적용 서비스 메서드 |
|---|---|---|
| 작품 등록·수정·삭제 | SCOUT | `S3.createTitle` / `updateTitle` / `deleteTitle` |
| 영화제·수상 이력 | SCOUT | `S4.addFestivalRecord` / `removeFestivalRecord` |
| 평가 스코어카드 | SCOUT | `S6.createEvaluation` |
| 코멘트 작성 | 전 역할 | `S7.createComment` (수정·삭제는 본인 것만) |
| 파이프라인 단계 변경 | SCOUT, ANALYST | `S5.changeStage` |
| 딜 — 오퍼 금액·유효기간 | ANALYST (변경) | `S8.saveDeal` |
| 딜 — MG·러닝 로열티·계약 조건 | ANALYST (변경) | `S8.saveDeal` (조회 차단은 필드 권한) |
| 재무 분석 | ANALYST (변경) | `S10.saveFinancialInput` |
| 판권 (영토·기간) | ANALYST | `S9.saveRights` |
| CSV 가져오기·내보내기 | SCOUT, ANALYST | `S12.commitImport`, `S13.exportTitles` |
| PDF·Excel 리포트 | ANALYST, EXECUTIVE | `S14.generateReport` |
| 사용자 계정 관리 | EXECUTIVE | `S2.createUser` / `changeRole` / `deleteUser` |

---

## 4. 트랜잭션 경계

트랜잭션은 **서비스가 열고 서비스가 닫는다.** 리포지토리는 트랜잭션을 열지 않는다.

| # | 서비스 메서드 | 트랜잭션 내 작업 | 이유 |
|---|---|---|---|
| T1 | `S5.changeStage` | ① `Title.stage` 갱신 ② `StageTransition` append | 단계만 바뀌고 이력이 누락되면 US-008의 "총합 = 경과 일수" 속성이 깨진다 |
| T2 | `S3.deleteTitle` | 작품 + 하위 전체(평가·코멘트·이력·딜·판권·재무) 삭제 | 부분 삭제 시 고아 레코드가 남는다 |
| T3 | `S3.createTitle` | ① `Title` 생성 ② 최초 `StageTransition` append (`from=null, to=DISCOVERY`) | 이력의 시작점이 없으면 체류 일수 계산의 기준이 사라진다 |
| T4 | `S7.createComment` | ① `Comment` 생성 ② 멘션 대상별 `Notification` 생성 | 코멘트는 남았는데 알림이 없는 상태를 방지 |
| T5 | `S12.commitImport` | 반영 대상 작품 전체 생성 + 각각의 최초 이력 append | 일부만 반영된 중간 상태를 방지 (`VALID_ONLY` 모드에서도 선택된 행 집합은 원자적으로 처리) |
| T6 | `S2.changeRole` / `deleteUser` | ① Executive 수 조회 ② 변경·삭제 | 조회와 변경 사이에 다른 Executive가 사라지는 경쟁 상태 방지 (US-029) |
| T7 | `S16.scanAndNotify` | 알림 유형별로 ① 중복 존재 확인 ② 생성 | 중복 알림 방지 (US-024) |

**트랜잭션을 쓰지 않는 경우**: 단일 리포지토리의 단일 쓰기(예: `S6.createEvaluation`, `S9.saveRights`)와 모든 조회는 트랜잭션 없이 수행한다.

---

## 5. 오케스트레이션 패턴

### 5.1 단계 전환 (S5.changeStage) — 트랜잭션 + 도메인 규칙

```
1. requireRole(ctx, SCOUT, ANALYST)              — Executive 차단
2. TitleRepository.findById → 없으면 NotFoundError
3. D5.isValidTransition(현재 단계, 목표 단계)     — 불가면 ValidationError
4. runInTransaction:
     a. TitleRepository.updateStage(titleId, toStage)
     b. StageTransitionRepository.append({ from, to, userId: ctx.userId, occurredAt: ctx.now, note })
5. 갱신된 Title 반환
```

### 5.2 재무 조회 (S10.getFinancials) — 도메인 모듈 위임

```
1. requireRole(ctx, ANALYST, EXECUTIVE)          — Scout 차단
2. DealRepository.findFinancialModel(titleId)    — 없으면 null 반환
3. D1.calculateFinancials(저장된 입력값)          — 산식은 여기서만 실행된다
4. 저장값 + 계산 결과를 합쳐 반환
```

> **NFR-008 준수 지점**: `S11 DashboardService`, `S13 ExportService`, `S14 ReportService`도 재무 값이 필요할 때 자체 계산하지 않고 **`S10.getFinancials` 또는 `D1`을 직접 호출**한다. 산식의 사본을 만들지 않는다.

### 5.3 내보내기 (S13.exportTitles) — 마스킹 우선 순서

```
1. requireRole(ctx, SCOUT, ANALYST)
2. TitleRepository.search(filter)                — 화면과 동일한 필터
3. (재무 컬럼 요청 시) D1으로 계산값 결합
4. X2.serializeForExport(ctx, ...)               — ★ 직렬화가 먼저
5. D4.serializeToCsv(마스킹된 rows, 남은 columns) — ★ 파일 생성은 나중
6. 파일 반환
```

> **순서가 중요하다.** 4번과 5번이 뒤바뀌면 마스킹 대상 값이 파일 문자열에 이미 포함된 뒤에 제거를 시도하게 된다. **직렬화 게이트를 통과한 데이터만 파일 생성 단계로 넘긴다.**

### 5.4 코멘트 작성 (S7.createComment) — 컴포넌트 간 협력

```
1. TitleRepository.findById → 없으면 NotFoundError
2. 본문에서 @멘션 토큰 추출 → UserRepository로 실제 사용자 해석
3. runInTransaction:
     a. CommentRepository.create
     b. S15.createMentionNotifications(작성자 제외한 멘션 대상)
4. 생성된 Comment 반환
```

> C4(평가·협업)가 C7(알림)의 서비스를 호출하는 유일한 지점이다. 이 방향(C4 → C7)만 허용되며 역방향은 없다.

### 5.5 가져오기 (S12) — 2단계 (미리보기 → 반영)

```
[1단계 previewImport]
1. requireRole(ctx, SCOUT, ANALYST)
2. D4.parseCsv → rows + errors
3. X4 스키마로 행별 검증 → 성공/오류 분류
4. 미리보기 반환 (아무것도 저장하지 않는다)

[2단계 commitImport]
5. 사용자가 ALL 또는 VALID_ONLY 선택
6. runInTransaction: 선택된 행 전체 생성 + 최초 이력 append
7. 결과 반환 (반영 건수, 제외 건수, 오류 행 목록 재다운로드 링크)
```

### 5.6 마감 알림 스캔 (S16.scanAndNotify) — 시스템 실행

```
1. 사용자 컨텍스트 없이 실행 (시스템 권한). 기동 시 1회 + 일 1회
2. DealRepository.listExpiringOffers(now, now+7d)
   → D3.shouldNotify(dDay, [7, 1]) 판정
3. DealRepository.listExpiringRights(now, now+30d)
   → D3.shouldNotify(dDay, [30, 7]) 판정
4. 각 대상에 대해 runInTransaction:
     a. NotificationRepository.exists(userId, type, subjectId, 'D-7' 등)
     b. 없을 때만 create
5. 생성 건수·건너뛴 건수 반환
```

---

## 6. 서비스 간 호출 규칙

원칙적으로 서비스는 다른 컴포넌트의 서비스를 호출하지 않는다. 아래 **3개 경로만 예외로 허용**한다.

| 허용 경로 | 목적 | 근거 |
|---|---|---|
| `S7 CommentService` → `S15 NotificationService` | 멘션 알림 생성 | US-012 |
| `S11 DashboardService` → `D1 FinancialCalculator` | 오퍼 금액 합계 등 집계 | NFR-008 (산식 재구현 금지) |
| `S13/S14 Export·Report` → `S10 FinancialService` 또는 `D1` | 리포트의 재무 값 | NFR-008 |

**금지 사항**
- 순환 호출 (A → B → A)
- 리포지토리가 서비스를 호출하는 역방향 의존
- 서비스가 API 경계(Route Handler)를 호출하는 역방향 의존
- 순수 도메인 모듈이 서비스·리포지토리를 호출하는 것

---

## 7. 서비스 ↔ 스토리 매핑

| 서비스 | 담당 스토리 |
|---|---|
| S1 AuthService | US-026 |
| S2 UserManagementService | US-028, US-029 |
| S3 TitleService | US-001, US-002, US-004 |
| S4 FestivalRecordService | US-003 |
| S5 PipelineService | US-005, US-006, US-007, US-008 |
| S6 EvaluationService | US-009, US-010 |
| S7 CommentService | US-011, US-012 |
| S8 DealService | US-013, US-014, US-017 |
| S9 RightsService | US-015 |
| S10 FinancialService | US-016, US-017 |
| S11 DashboardService | US-018, US-019, US-020 |
| S12 ImportService | US-021 |
| S13 ExportService | US-022 |
| S14 ReportService | US-025 |
| S15 NotificationService | US-012, US-023 |
| S16 DeadlineScanService | US-024 |
| S17 BootstrapService | US-030, US-031 |
| (플랫폼 X1·X2·X5 조합) | US-027 |
| (FormattingModule, C8) | US-032 |

**검증**: 32개 스토리 전부가 담당 서비스 또는 플랫폼 조합에 배정됨.
