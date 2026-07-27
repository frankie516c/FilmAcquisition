# Business Logic Model — U5 Dashboard & Reports

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U5 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 구성 요소

| 파일 | 역할 |
|---|---|
| `modules/dashboard/service.ts` | 위젯 3종 집계 |
| `modules/dataio/export-service.ts` | CSV 내보내기 |
| `modules/dataio/import-service.ts` | CSV 템플릿·미리보기·반영 |
| `modules/dataio/notification-service.ts` | 알림 조회·읽음·마감 스캔 |
| `modules/dataio/report-service.ts` | 리포트 3종 데이터 구성 |
| `domain/csv.ts` | D4 — 직렬화·파싱 (순수, PBT 4속성) |
| `domain/deadline.ts` | D3 — D-day (순수, PBT 4속성) |
| `platform/authz/serialize.ts` | `gateExportRows` — 컬럼 단위 마스킹 |

---

## 2. 대시보드 집계

### 2.1 파이프라인 현황

```
getPipelineOverview(ctx):
 1. listTitlesWithHistory()               전 작품 + 이력 + 딜
 2. 단계별로 분류 → count, Σ deal.offerAmount
 3. 작품마다 calculateDwellSegments(createdAt, transitions, ctx.now)
 4. findBottleneckStage(전체 구간)          종료 단계 제외
 5. maxCount = 막대 그래프 정규화용
```

> ⚠️ **전 작품의 이력을 메모리로 가져옵니다.** 500건이면 2,000~3,000 레코드입니다.
> 24건 기준 p95 94ms지만 규모에 따라 나빠질 수 있습니다.

### 2.2 포트폴리오 구성

```
getPortfolioComposition(ctx, basis):
 1. 전 작품 조회 → basis가 CLOSED_WON이면 해당 단계만 필터
 2. MAJOR_GENRES 6종에 대해 pool.filter(t => t.genres.includes(code)).length
 3. 국가별 count는 Map으로 집계
 4. gaps = count === 0인 장르
```

**`GROUP BY`가 아니라 메모리 집계입니다.** `genres`가 배열 컬럼이라 SQL 집계가 번거롭고,
현재 규모에서는 차이가 없습니다. 500건에서는 재검토 대상입니다.

### 2.3 마감 임박

```
getUpcomingDeadlines(ctx, rangeDays):
 1. 전 작품 + 전 판권 조회
 2. 각각 calculateDDay(ctx.now, 만료일)
 3. dDay > rangeDays 인 것 제외          ※ 음수(만료)는 남긴다
 4. classifyDeadline(dDay, rangeDays)
 5. dDay 오름차순 정렬 → 만료된 것이 먼저
```

**DB에서 거르지 않고 전부 가져온 뒤 필터링합니다.** 개선 1순위입니다
(performance-test-instructions.md 5절).

---

## 3. CSV 내보내기

### 3.1 흐름 — 순서가 설계의 핵심

```
exportTitles(ctx, filter):
 1. requireRole(ctx, SCOUT, ANALYST)
 2. listTitles(filter)                      화면과 같은 필터
 3. attachFinancials(titleIds)              D1으로 재무 계산
 4. raw = 작품 + 딜 + 재무를 한 행으로 평탄화
 5. gated = gateExportRows(role, COLUMNS, raw)    ★ 마스킹 먼저
 6. content = serializeToCsv(gated.rows, gated.columns)   ★ 파일 생성 나중
 7. { content, omittedColumns }
```

**5번과 6번의 순서를 바꾸면** 마스킹 대상 값이 이미 CSV 문자열에 들어간 뒤 제거를 시도하게
됩니다. 문자열에서 값을 지우는 것은 신뢰할 수 없습니다.

### 3.2 `gateExportRows` — 컬럼 단위 판정

기존 `serialize()`는 엔티티 하나를 전제하는데, 내보내기 행은 작품·딜·재무가 섞여 있습니다.
그래서 **컬럼마다 소속 엔티티를 선언**하고 컬럼 단위로 판정합니다.

```ts
{ key: "minimumGuarantee", header: "MG", entity: "Deal" }
{ key: "roiPercent",       header: "ROI(%)", entity: "FinancialModel" }
```

```
allowed = columns.filter(c => canReadEntity(role, c.entity) && canReadField(role, c.entity, c.key))
```

차단된 컬럼은 **헤더에서도 빠지므로** 빈 열이 남지 않습니다.

### 3.3 컬럼 구성 (최대 17개)

| 그룹 | 컬럼 | Scout |
|---|---|---|
| Title (7) | 제목·원제·감독·제작연도·단계·담당자·종합점수 | ✅ |
| Deal (6) | 오퍼금액·오퍼만료일 / 요청가·MG·러닝로열티율·계약조건 | 앞 2개만 |
| FinancialModel (4) | 예상매출·총인수비용·예상손익·ROI(%) | ❌ 전부 |

---

## 4. CSV 가져오기

### 4.1 2단계 구조

```
[미리보기]  POST /api/import/titles  (mode 없음)
  parseCsv → 행별 validate → { totalRows, validCount, issues, sample }
  ※ DB 접근 없음

[반영]      POST /api/import/titles  mode=VALID_ONLY | ALL
  previewImport를 다시 실행          ← 클라이언트 데이터를 신뢰하지 않는다
  ALL인데 issues가 있으면 → 400
  runInTransaction: 유효 행마다 Title + 최초 StageTransition 생성
```

**반영 시 원본을 다시 파싱하는 이유**: 미리보기 결과를 클라이언트가 되돌려 보내는 것을
그대로 쓰면, 조작된 행을 보내 검증을 우회할 수 있습니다.

### 4.2 행 검증

```
행마다:
  genres = 문자열을 [;,|] 로 분할 → 한국어 라벨을 코드로 매핑
  validate(titleCreateSchema, {...})
    실패 → error.fields를 행 번호와 함께 issues에 추가
  알 수 없는 장르가 있으면 → issues에 추가하고 그 행 제외
```

**행 번호는 `배열 인덱스 + 2`** 입니다. 헤더가 1행이므로 데이터 첫 행이 2행입니다.
사용자가 스프레드시트에서 바로 찾을 수 있어야 합니다.

### 4.3 D4 — CSV 직렬화 (순수, PBT 4속성)

**직렬화**
- 구분자 `,`, 줄바꿈 `CRLF`
- 값에 `,` `"` `CR` `LF` 중 하나라도 있으면 전체를 `"`로 감싸고 내부 `"`는 `""`로
- 선두에 **UTF-8 BOM** — Excel의 한글 깨짐 방지

**파싱**
- **BOM을 먼저 제거** (안 하면 첫 헤더가 매칭 실패)
- 상태 기계로 인용 구간을 추적 — 인용 안에서는 개행도 값의 일부
- `CRLF`와 `LF` 모두 허용
- **어떤 경우에도 예외를 던지지 않고** `errors` 배열에 수집

**왕복 무손실의 성립 범위**: 값이 전부 문자열일 때 성립합니다.
`null`은 빈 문자열로 복원되는데, CSV에 "빈 값"과 "값 없음"을 구분할 표현이 없기 때문입니다.
상위 계층이 빈 문자열을 `null`로 정규화합니다.

---

## 5. 알림

### 5.1 마감 스캔 (T7)

```
scanAndNotify(now):
 1. offerExpiryDate가 있는 딜 전체 조회
      dDay = calculateDDay(now, expiry)
      shouldNotify(dDay, [7,1]) 이면 → createOnce(...)
 2. 판권 전체 조회
      shouldNotify(dDay, [30,7]) 이면 → createOnce(...)
 3. { created, skipped }

createOnce(input):
  담당자 없으면 → false
  try  create(...)              → true
  catch P2002 (UNIQUE 위반)      → false      ← 경쟁 상태에서도 중복 없음
  catch 그 외                    → throw
```

**`shouldNotify`가 `includes(dDay)`인 것이 핵심입니다.** 범위 비교가 아닙니다.

### 5.2 멘션 알림

U2의 `createComment`가 생성합니다(T4). U5는 조회와 읽음 처리만 담당합니다.

### 5.3 조회

```
listNotifications(ctx)  →  ctx.userId의 알림 최근 50건, 작품 정보 포함
countUnread(ctx)        →  isRead=false 개수
markAllAsRead(ctx)      →  updateMany
```

**폴링하지 않습니다.** 드롭다운을 열 때만 조회하고, 배지 초기값은 서버 렌더 시점의 값입니다.

---

## 6. 리포트

### 6.1 공통 구조

```
Report {
  kind, title,
  generatedAt,      // "2026-07-26 17:43"
  generatedBy,      // ctx.userName
  sections: [{ heading, columns: string[], rows: string[][] }]
}
```

**섹션을 `columns`/`rows` 문자열 배열로 정규화**한 이유: 인쇄용 HTML과 CSV가 같은 구조를
소비합니다. 형식마다 다른 데이터 구조를 만들면 두 출력이 어긋납니다.

### 6.2 세 종류

| 종류 | 섹션 |
|---|---|
| `pipeline` | 단계별 현황 · 병목 구간 · 30일 내 마감 |
| `portfolio` | 계약체결 기준 장르 분포 · 라인업 갭 · 전체 기준 분포 |
| `titles` | 작품 목록 (8컬럼) |

### 6.3 두 가지 출력

**인쇄용 HTML** (`/reports/{kind}`)
```
@media print { .rail, .top, .no-print { display: none } ... }
```
레일·상단바·인쇄 버튼을 숨기고 본문만 남깁니다. 사용자가 Ctrl+P로 PDF 저장합니다.

**Excel용 CSV** (`GET /api/reports/{kind}`)
섹션마다 컬럼 수가 다르므로 최대 폭에 맞춰 단일 표로 평탄화하고, 섹션 제목 행을 사이에
넣습니다. BOM이 붙어 Excel에서 한글이 정상 표시됩니다.

> **서버 PDF 생성을 하지 않는 것은 의도적 대체입니다** (BR-U5-027). 한글 TTF 포함 비용을
> 피했고, 대신 생성 주체가 클라이언트가 되었습니다. 이 차이를 화면에도 적었습니다.
