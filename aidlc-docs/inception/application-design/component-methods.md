# Component Methods — Film Acquisition Dashboard

**작성일**: 2026-07-25
**단계**: 🔵 INCEPTION — Application Design

> **범위 주의**: 이 문서는 **메서드 시그니처와 상위 수준 목적**만 정의한다. 상세 비즈니스 규칙(계산 순서, 예외 처리 분기, 검증 실패 시 세부 동작, 인덱스 설계 등)은 **Construction 단계의 Functional Design**에서 유닛별로 정의한다.

**표기**: TypeScript 유사 문법. `Ctx`는 `RequestContext`(현재 사용자·역할)를 의미하며 모든 서비스 메서드의 첫 인자로 전달된다.

---

## 1. 순수 도메인 모듈 (PBT 대상 포함)

이 모듈들은 **아무것도 import 하지 않는다.** 현재 시각도 인자로 받는다.

### D1. FinancialCalculator `[PBT]`

```ts
type Money = number            // KRW 정수 (원 단위)

interface FinancialInput {
  offerAmount: Money           // 오퍼 금액 (또는 MG)
  paAndBudget: Money           // P&A(마케팅) 예산
  otherCosts: Money            // 기타 비용
  expectedRevenue: Money       // 예상 매출
}

interface FinancialResult {
  totalAcquisitionCost: Money  // 총 인수비용
  expectedProfit: Money        // 예상 손익
  roiPercent: number | null    // ROI(%). 총 인수비용이 0이면 null (= 화면에서 N/A)
  breakEvenRevenue: Money      // 손익분기 매출
}

function calculateFinancials(input: FinancialInput): FinancialResult
```

**PBT 검증 속성**
| # | 속성 |
|---|---|
| P1 | `breakEvenRevenue === totalAcquisitionCost` (항상) |
| P2 | `expectedRevenue === totalAcquisitionCost` 이면 `expectedProfit === 0` 이고 `roiPercent === 0` |
| P3 | `expectedRevenue`를 증가시키면 `expectedProfit`과 `roiPercent`는 감소하지 않는다 (단조성) |
| P4 | `totalAcquisitionCost === 0` 이면 `roiPercent === null` (예외를 던지지 않는다) |
| P5 | 모든 결과 금액은 정수다 (부동소수점 오차가 발생하지 않는다) |

---

### D2. DwellTimeCalculator `[PBT]`

```ts
interface TransitionRecord {
  fromStage: Stage | null      // 최초 등록 시 null
  toStage: Stage
  occurredAt: Date
}

interface DwellSegment {
  stage: Stage
  enteredAt: Date
  exitedAt: Date | null        // 현재 단계면 null
  days: number
}

function calculateDwellSegments(
  createdAt: Date,
  transitions: readonly TransitionRecord[],
  now: Date                    // 주입받는다 — 전역 시각을 읽지 않는다
): DwellSegment[]

function findBottleneckStage(
  segmentsByTitle: readonly DwellSegment[][]
): { stage: Stage; averageDays: number } | null
```

**PBT 검증 속성**
| # | 속성 |
|---|---|
| P1 | 모든 `days >= 0` |
| P2 | `days`의 총합 === `createdAt`부터 `now`까지의 경과 일수 |
| P3 | 세그먼트는 시간순으로 연속하며 구간이 겹치지 않는다 |
| P4 | 이력이 0건이면 세그먼트는 1개(최초 단계)이고 그 `exitedAt`은 null |

---

### D3. DeadlineCalculator `[PBT]`

```ts
type DeadlineStatus = 'expired' | 'imminent' | 'upcoming' | 'out-of-range'

function calculateDDay(baseDate: Date, targetDate: Date): number
  // 반환값: 0 = 오늘 만료(D-0), 양수 = 남은 일수, 음수 = 만료 경과

function classifyDeadline(
  dDay: number,
  rangeDays: 7 | 30 | 90
): DeadlineStatus

function shouldNotify(dDay: number, thresholds: readonly number[]): boolean
  // 오퍼: [7, 1] · 판권: [30, 7]
```

**PBT 검증 속성**
| # | 속성 |
|---|---|
| P1 | `targetDate === baseDate` 이면 `dDay === 0` |
| P2 | `targetDate`를 하루 늘리면 `dDay`는 정확히 1 증가한다 (선형성) |
| P3 | 계산은 `Asia/Seoul` 기준 달력일 경계로 수행되며, 시각(시·분·초) 차이는 결과에 영향을 주지 않는다 |
| P4 | `dDay < 0` 이면 `classifyDeadline`은 항상 `'expired'` |

---

### D4. CsvSerializer `[PBT]`

```ts
interface CsvColumn { key: string; header: string }

function serializeToCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[]
): string

function parseCsv(
  content: string,
  columns: readonly CsvColumn[]
): { rows: Record<string, string>[]; errors: CsvRowError[] }

interface CsvRowError { rowNumber: number; column: string; reason: string }
```

**PBT 검증 속성**
| # | 속성 |
|---|---|
| P1 | **왕복 무손실** — `parseCsv(serializeToCsv(rows, cols), cols).rows` 는 `rows`와 동일하다 |
| P2 | P1은 값에 한글·쉼표·큰따옴표·줄바꿈이 포함되어도 성립한다 |
| P3 | 파싱 오류가 있어도 예외를 던지지 않고 `errors`에 행 번호와 사유를 담아 반환한다 |
| P4 | `serializeToCsv`의 첫 행은 항상 `columns`의 `header` 순서와 일치한다 |

---

### D5. PipelineRules

```ts
type Stage =
  | 'DISCOVERY' | 'SCREENING' | 'EVALUATION' | 'OFFER'
  | 'NEGOTIATION' | 'CLOSED_WON' | 'REJECTED'

const STAGE_ORDER: readonly Stage[]
const TERMINAL_STAGES: readonly Stage[]        // CLOSED_WON, REJECTED

function isValidTransition(from: Stage, to: Stage): boolean
  // 종료 상태에서 이전 단계로의 되돌리기도 true (오기입 정정 허용)

function getStageLabel(stage: Stage): string   // 한국어 표시명
```

---

### D6. ScoreCalculator

```ts
interface EvaluationScores {
  artistry: number       // 작품성 1~5
  commerciality: number  // 상업성 1~5
  buzz: number           // 화제성 1~5
  targetFit: number      // 타깃 적합성 1~5
}

function calculateEvaluationScore(scores: EvaluationScores): number
function calculateOverallScore(
  allScores: readonly EvaluationScores[]
): { score: number; count: number } | null   // 0건이면 null (= 미평가)
```

---

## 2. 플랫폼 컴포넌트

### X1. AuthorizationPolicy

```ts
type Role = 'SCOUT' | 'ANALYST' | 'EXECUTIVE'
type Action = 'create' | 'read' | 'update' | 'delete' | 'execute'

function canPerform(role: Role, resource: string, action: Action): boolean
function canReadField(role: Role, entity: string, field: string): boolean
  // 정책에 없는 필드는 false (차단 기본값)

function getReadableFields(role: Role, entity: string): readonly string[]
```

### X2. SerializationGate

```ts
function serialize<T extends object>(
  ctx: Ctx,
  entity: string,
  data: T
): Partial<T>
  // 정책상 읽을 수 없는 필드의 키를 제거한다 (null 대입이 아님)

function serializeMany<T extends object>(
  ctx: Ctx,
  entity: string,
  data: readonly T[]
): Partial<T>[]

function serializeForExport<T extends object>(
  ctx: Ctx,
  entity: string,
  data: readonly T[],
  columns: readonly CsvColumn[]
): { rows: Partial<T>[]; columns: CsvColumn[] }
  // 제거된 필드는 컬럼 목록에서도 빠진다 (CSV·Excel·PDF 공통)
```

### X3. ErrorMapper

```ts
class ValidationError extends Error { readonly fields: FieldIssue[] }
class NotFoundError extends Error {}
class ForbiddenError extends Error {}
class ConflictError extends Error {}
class AuthenticationError extends Error {}   // 원인을 메시지에 담지 않는다

function toHttpResponse(error: unknown): { status: number; body: ErrorBody }
  // ValidationError→400 · AuthenticationError→401 · ForbiddenError→403
  // NotFoundError→404 · ConflictError→409 · 그 외→500
```

### X4. ValidationSchemas

```ts
const titleCreateSchema, titleUpdateSchema
const festivalRecordSchema
const evaluationSchema            // 각 점수 1~5 정수
const commentSchema
const dealSchema                  // 유효기간 >= 제출일, 금액 비음수 정수
const rightsGrantSchema           // 종료일 > 시작일
const financialInputSchema        // 금액 비음수 정수
const userCreateSchema, userRoleUpdateSchema
const loginSchema

function validate<T>(schema: Schema<T>, input: unknown): T   // 실패 시 ValidationError
```

### X5. RequestContext

```ts
interface Ctx {
  readonly userId: string
  readonly role: Role
  readonly now: Date              // 요청 시각. 도메인 모듈에 주입된다
}

function requireContext(request: Request): Promise<Ctx>   // 미인증 시 AuthenticationError
function requireRole(ctx: Ctx, ...allowed: Role[]): void  // 불일치 시 ForbiddenError
```

### X6. PersistenceUnit

```ts
function runInTransaction<T>(work: (tx: RepositoryBundle) => Promise<T>): Promise<T>

interface RepositoryBundle {
  users: UserRepository
  titles: TitleRepository
  stageTransitions: StageTransitionRepository
  evaluations: EvaluationRepository
  comments: CommentRepository
  deals: DealRepository
  notifications: NotificationRepository
}
```

---

## 3. 리포지토리 인터페이스

```ts
interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  list(): Promise<User[]>
  create(data: NewUser): Promise<User>
  updateRole(id: string, role: Role): Promise<User>
  delete(id: string): Promise<void>
  countByRole(role: Role): Promise<number>          // 마지막 Executive 보호용
}

interface TitleRepository {
  findById(id: string): Promise<Title | null>
  findByOriginalTitleAndYear(originalTitle: string, year: number): Promise<Title[]>
  search(filter: TitleFilter): Promise<Title[]>
  countByStage(): Promise<Record<Stage, number>>
  create(data: NewTitle): Promise<Title>
  update(id: string, data: TitleUpdate): Promise<Title>
  updateStage(id: string, stage: Stage): Promise<Title>
  delete(id: string): Promise<void>                 // 하위 엔티티 cascade
  addFestivalRecord(titleId: string, data: NewFestivalRecord): Promise<FestivalRecord>
  listFestivalRecords(titleId: string): Promise<FestivalRecord[]>
  deleteFestivalRecord(id: string): Promise<void>
}

interface StageTransitionRepository {
  append(data: NewStageTransition): Promise<StageTransition>
  listByTitle(titleId: string): Promise<StageTransition[]>
  listAll(): Promise<StageTransition[]>
  // update·delete 메서드는 정의하지 않는다 — append-only의 구조적 강제 (FR-006)
}

interface EvaluationRepository {
  listByTitle(titleId: string): Promise<Evaluation[]>
  create(data: NewEvaluation): Promise<Evaluation>
  update(id: string, data: EvaluationUpdate): Promise<Evaluation>
}

interface CommentRepository {
  listByTitle(titleId: string): Promise<Comment[]>
  findById(id: string): Promise<Comment | null>
  create(data: NewComment): Promise<Comment>
  update(id: string, body: string): Promise<Comment>
  delete(id: string): Promise<void>
}

interface DealRepository {
  findByTitle(titleId: string): Promise<Deal | null>
  upsert(titleId: string, data: DealInput): Promise<Deal>
  listExpiringOffers(from: Date, to: Date): Promise<Deal[]>
  listRightsByTitle(titleId: string): Promise<RightsGrant[]>
  createRights(titleId: string, data: RightsInput): Promise<RightsGrant>
  updateRights(id: string, data: RightsInput): Promise<RightsGrant>
  listExpiringRights(from: Date, to: Date): Promise<RightsGrant[]>
  findFinancialModel(titleId: string): Promise<FinancialModel | null>
  upsertFinancialModel(titleId: string, data: FinancialInput): Promise<FinancialModel>
}

interface NotificationRepository {
  listByUser(userId: string): Promise<Notification[]>
  countUnread(userId: string): Promise<number>
  create(data: NewNotification): Promise<Notification>
  markRead(id: string): Promise<void>
  exists(userId: string, type: NotificationType, subjectId: string, marker: string): Promise<boolean>
  // marker = 'D-7' 등. 중복 알림 방지용 (US-024)
}
```

---

## 4. 기능 컴포넌트 서비스 메서드

### C1. AuthComponent

```ts
// AuthService
login(email: string, password: string): Promise<Session>       // 실패 시 AuthenticationError (원인 미노출)
logout(ctx: Ctx): Promise<void>
getCurrentUser(ctx: Ctx): Promise<User>

// UserManagementService  — Executive 전용
listUsers(ctx: Ctx): Promise<User[]>
createUser(ctx: Ctx, input: NewUserInput): Promise<User>
changeRole(ctx: Ctx, userId: string, role: Role): Promise<User>  // 마지막 Executive면 ConflictError
deleteUser(ctx: Ctx, userId: string): Promise<void>              // 마지막 Executive면 ConflictError
```

### C2. TitleComponent

```ts
// TitleService
createTitle(ctx: Ctx, input: TitleInput): Promise<Title>
findDuplicateCandidates(ctx: Ctx, originalTitle: string, year: number): Promise<Title[]>
getTitle(ctx: Ctx, id: string): Promise<TitleDetail>
updateTitle(ctx: Ctx, id: string, input: TitleUpdate): Promise<Title>
deleteTitle(ctx: Ctx, id: string): Promise<void>                 // 트랜잭션 + cascade
searchTitles(ctx: Ctx, filter: TitleFilter): Promise<Title[]>

// FestivalRecordService
addFestivalRecord(ctx: Ctx, titleId: string, input: FestivalInput): Promise<FestivalRecord>
listFestivalRecords(ctx: Ctx, titleId: string): Promise<FestivalRecord[]>   // 연도 내림차순
removeFestivalRecord(ctx: Ctx, id: string): Promise<void>
```

### C3. PipelineComponent

```ts
// PipelineService
getBoard(ctx: Ctx): Promise<BoardColumn[]>                       // 단계별 카드 + 건수
changeStage(ctx: Ctx, titleId: string, toStage: Stage, note?: string): Promise<Title>
  // 트랜잭션: 단계 갱신 + 이력 append. Executive는 ForbiddenError
getStageHistory(ctx: Ctx, titleId: string): Promise<StageHistoryView>
  // D2에 createdAt·transitions·ctx.now를 넘겨 체류 일수를 산출
```

### C4. EvaluationComponent

```ts
// EvaluationService
createEvaluation(ctx: Ctx, titleId: string, input: EvaluationInput): Promise<Evaluation>
listEvaluations(ctx: Ctx, titleId: string): Promise<Evaluation[]>
getOverallScore(ctx: Ctx, titleId: string): Promise<{ score: number; count: number } | null>

// CommentService
listComments(ctx: Ctx, titleId: string): Promise<Comment[]>
createComment(ctx: Ctx, titleId: string, body: string): Promise<Comment>
  // 본문에서 @멘션 추출 → NotificationService.createMentionNotifications 호출
updateComment(ctx: Ctx, id: string, body: string): Promise<Comment>   // 타인 것이면 ForbiddenError
deleteComment(ctx: Ctx, id: string): Promise<void>                    // 타인 것이면 ForbiddenError
```

### C5. DealComponent

```ts
// DealService  — 변경은 Analyst 전용
getDeal(ctx: Ctx, titleId: string): Promise<Partial<Deal> | null>     // X2 게이트 통과
saveDeal(ctx: Ctx, titleId: string, input: DealInput): Promise<Deal>

// RightsService  — 변경은 Analyst 전용
listRights(ctx: Ctx, titleId: string): Promise<RightsGrant[]>
saveRights(ctx: Ctx, titleId: string, input: RightsInput): Promise<RightsGrant>

// FinancialService  — 변경은 Analyst 전용, 조회는 Analyst·Executive
getFinancials(ctx: Ctx, titleId: string): Promise<FinancialView | null>
  // D1.calculateFinancials를 호출한다. 산식을 직접 구현하지 않는다
saveFinancialInput(ctx: Ctx, titleId: string, input: FinancialInput): Promise<FinancialView>
```

### C6. DashboardComponent

```ts
// DashboardService  — 전 역할 조회 가능, 응답은 X2 게이트 통과
getPipelineOverview(ctx: Ctx): Promise<PipelineOverview>
  // 단계별 건수 · 단계별 오퍼 금액 합계 · 병목 단계(D2)
getPortfolioComposition(ctx: Ctx, basis: 'CLOSED_WON' | 'ALL'): Promise<PortfolioComposition>
  // 장르·국가·등급 분포 + 라인업 갭
getUpcomingDeadlines(ctx: Ctx, rangeDays: 7 | 30 | 90): Promise<DeadlineItem[]>
  // D3로 D-day 산출, 마감일 오름차순, 만료분은 별도 표시
```

### C7. DataIOComponent

```ts
// ImportService
getTemplate(ctx: Ctx): Promise<{ filename: string; content: string }>
previewImport(ctx: Ctx, file: Buffer): Promise<ImportPreview>
  // D4.parseCsv 사용. 반영하지 않고 성공·오류 건수와 행별 사유만 반환
commitImport(ctx: Ctx, previewId: string, mode: 'ALL' | 'VALID_ONLY'): Promise<ImportResult>

// ExportService
exportTitles(ctx: Ctx, filter: TitleFilter, format: 'CSV' | 'XLSX'): Promise<FileResult>
  // X2.serializeForExport → D4.serializeToCsv 순서. 역할별 컬럼이 제거된다

// ReportService  — Analyst·Executive 전용
generateReport(ctx: Ctx, kind: ReportKind, format: 'PDF' | 'XLSX'): Promise<FileResult>
  // 머리말에 생성 시각·생성자 포함. 한글 폰트 임베딩

// NotificationService
listNotifications(ctx: Ctx): Promise<Notification[]>
countUnread(ctx: Ctx): Promise<number>
markAsRead(ctx: Ctx, id: string): Promise<void>
createMentionNotifications(ctx: Ctx, commentId: string, mentionedUserIds: string[]): Promise<void>
  // 작성자 본인은 제외

// DeadlineScanService  — 시스템 실행 (기동 시 1회 + 일 1회)
scanAndNotify(now: Date): Promise<{ created: number; skipped: number }>
  // D3.shouldNotify로 판정, NotificationRepository.exists로 중복 방지
```

### C8. FoundationComponent

```ts
// BootstrapService
ensureMigrated(): Promise<void>
ensureSeeded(): Promise<{ seeded: boolean }>        // 멱등. 이미 있으면 건너뛴다
verifyRequiredEnv(): void                            // 누락 시 기동 실패

// FormattingModule  (순수)
formatKrw(amount: number): string                    // 천 단위 구분 기호
formatDate(date: Date): string                       // YYYY-MM-DD, Asia/Seoul
```

---

## 5. Functional Design으로 이관되는 항목

이 문서는 시그니처까지만 정의한다. 다음은 **Construction 단계의 Functional Design**에서 유닛별로 정의한다.

| 항목 | 예시 |
|---|---|
| 상세 계산 순서·반올림 규칙 | ROI 소수점 자리수, 금액 반올림 방향 |
| 예외 분기의 세부 동작 | 중복 후보가 여러 건일 때의 표시 순서, cascade 실패 시 처리 |
| DB 스키마 상세 | 컬럼 타입, 인덱스, 유니크 제약, cascade 옵션 |
| 필터 조합 의미 | 다중 선택 필터의 AND/OR 규칙 |
| 알림 임계값의 정확한 판정 시각 | D-7 판정의 기준 시각 |
| 시드 데이터의 구체적 내용 | 작품 건수, 각 단계 배치, 만료 임박 항목 구성 |
