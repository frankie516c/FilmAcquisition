# AI-DLC State Tracking

## Project Information
- **Project Name**: Film Acquisition Dashboard
- **Project Type**: Greenfield
- **Start Date**: 2026-07-25T05:27:09Z
- **Current Phase**: 🟢 CONSTRUCTION (INCEPTION complete 2026-07-25T07:14:00Z)
- **Current Unit**: U1 Foundation & Auth (1 of 5)
- **Current Stage**: ⚠️ **PROCESS DEVIATION** — per-unit approval gates suspended at user's direction (time constraint, 2026-07-25T07:30:00Z)
- **Deliverable focus**: (1) interactive prototype — PUBLISHED at https://claude.ai/code/artifact/19b85acd-e264-4dac-8490-119297a302ba · (2) Next.js + Prisma source code — in progress
- **Environment blocker**: node, npm and docker are all absent from this machine — the app cannot be run or demonstrated locally here
- **To resume standard AI-DLC**: U1 frontend-components.md, then U2-U5 Functional Design → Code Gen Planning → Code Gen, then Build and Test

## Delivered Under Deviation (2026-07-25T07:30:00Z onward)
### 1. Interactive prototype — PUBLISHED
https://claude.ai/code/artifact/19b85acd-e264-4dac-8490-119297a302ba
Covers U1-U5 behaviour: role switching with a live API payload inspector showing masked keys disappearing, kanban with append-only history and role-gated drag, three dashboard widgets, financial calculation, last-executive protection. Uses the seed spec from business-logic-model.md §8 verbatim.

### 2. U1 Foundation & Auth source code — IMPLEMENTED at workspace root
- Config: package.json, tsconfig.json, next.config.ts, vitest.config.ts, Dockerfile, docker-compose.yml, .env.example, .gitignore, README.md
- Schema: prisma/schema.prisma (all 10 entities, BigInt money, append-only StageTransition without updatedAt, Notification unique constraint for duplicate prevention), prisma/seed.ts (5 users, 24 titles, 12 deals, 8 financials, 4 rights, relative expiry dates)
- Pure domain (no external imports): calendar.ts (dayIndex), financials.ts (D1, single definition point), dwell-time.ts (D2), deadline.ts (D3), csv.ts (D4, RFC 4180 + BOM), pipeline-rules.ts (D5), score.ts (D6)
- Platform: authz/policy.ts (X1, default-block field policy), authz/serialize.ts (X2, key removal + BigInt/Date conversion), errors/index.ts (X3), validation/schemas.ts (X4, Zod), context/index.ts (X5, role read from session per request), db/index.ts (X6, transactions)
- Module: modules/auth/service.ts (login with timing-attack countermeasure, user management, T6 transactional last-executive protection)
- API: /api/auth/login, /api/auth/logout, /api/users, /api/users/[id]
- Tests: 17 property-based assertions across 4 files + authz unit tests verifying key-absence rather than null

### 3. UI and read paths across U2-U5 — IMPLEMENTED (second deviation session)
- Design tokens: src/app/globals.css (same plum palette as the prototype, both themes)
- Screens: /login (with demo account buttons), (app) shell with rail + role indicator + logout, /dashboard (3 widgets with stage-click filtering and basis/range switching), /titles (list), /titles/[id] (detail showing deal masking, financial entity block, and the dwell-total-equals-elapsed check), /board (7-column kanban with drag, role-gated), /users (management with last-executive protection)
- Services: modules/titles/repository.ts, modules/pipeline/service.ts (transaction T1), modules/dashboard/service.ts (3 widget aggregations, calls D1/D2/D3 rather than reimplementing)
- API: /api/pipeline/[id]/stage

### Unit status after deviation
- U1 Foundation & Auth — COMPLETE (incl. login and user management screens)
- U2 Title & Evaluation — read paths only (list, search, detail with evaluations/comments/festivals). Create/edit forms not written.
- U3 Pipeline — COMPLETE (board, drag stage change, append-only history, dwell time)
- U4 Deal & Financials — read paths only (masked display, ROI calculation). Input forms not written.
- U5 Dashboard & Reports — 3 widgets only. CSV import/export, PDF/Excel reports and notification centre not written.

### Not implemented
- Write forms: title create/edit, evaluation, comment, deal, rights, financial input
- CSV import/export, PDF/Excel reports, notification centre and deadline scan job
## VERIFICATION RUN (2026-07-25T16:36-16:47 KST)
Node 24.18.0 + npm 11.16.0 installed via winget (user scope, no admin).
Node path: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*\node-v24.18.0-win-x64`

| 검증 | 결과 |
|---|---|
| `npm install` | ✅ 152 packages. npm 11의 allowScripts 정책으로 install script 5종을 명시 승인 (package.json에 기록됨) |
| `prisma generate` | ✅ 성공 — 스키마 10개 엔티티 유효 |
| `tsc --noEmit` | ✅ 오류 0건 (수정 후) |
| `vitest run` | ✅ **26/26 통과** — PBT 17속성 + authz 단위 8건, 첫 실행부터 전부 통과 |
| `next build` | ✅ 라우트 12개 빌드 성공 (수정 후) |
| 서버 기동 + `/login` | ✅ HTTP 200, 데모 계정 렌더링 확인 |
| 미인증 `/dashboard` | ✅ 307 → `/login` 리다이렉트 |
| 미인증 `/api/users` | ✅ 401 + 규격 오류 본문 |
| DB 연동 흐름 (migrate·seed·로그인·화면 데이터) | ❌ **미검증** — PostgreSQL 설치가 완료되지 않음 |

### 실행으로 발견해 고친 결함 3건
1. **`TxLike` 타입 불일치** (`modules/auth/service.ts`) — 손으로 만든 트랜잭션 인터페이스가 Prisma 제네릭과 호환되지 않아 typecheck 실패. `Tx` 타입 직접 사용으로 수정. *예측했던 지점이 그대로 터짐.*
2. **`@node-rs/argon2` 네이티브 바인딩 로드 실패** — Windows에서 MSVC 런타임 부재로 `ERR_DLOPEN_FAILED`, 빌드의 page data 수집 단계에서 전체 실패. WASM 구현(`hash-wasm`)으로 교체해 argon2id는 유지하고 네이티브 의존 제거. `src/platform/password.ts` 신설.
3. **미로그인 상태 오류 메시지 오용** — 세션 없음/만료에도 "이메일 또는 비밀번호가 올바르지 않습니다"가 반환됨. `AuthenticationError`에 선택적 메시지를 두고 `requireContext`가 `SESSION_REQUIRED`를 전달하도록 수정. 로그인 실패 경로는 기본 메시지를 그대로 써 BR-U1-002(원인 미구분)를 유지.

## 2차 검증 — DB 연동 전 구간 (2026-07-25T17:00 KST 이후)
PostgreSQL 17 설치 완료 후 진행. 롤 `fad` 생성, DB `fad` 생성(기존 객체 삭제 없음), `CREATEDB` 부여(Prisma shadow database용).

| 검증 | 결과 |
|---|---|
| `prisma migrate dev --name init` | ✅ 마이그레이션 생성·적용, 테이블 10개 |
| `npm run db:seed` | ✅ 사용자 5명 · 작품 24편 · 딜 12건 · 재무 8건 |
| 로그인 3역할 | ✅ 전부 200 |
| 잘못된 비밀번호 / 없는 계정 | ✅ 둘 다 401, **완전히 동일한 메시지** (BR-U1-002 실증) |
| **역할별 마스킹 (실데이터)** | ✅ Scout: MG 미노출·마스킹 라벨 표시·재무 엔티티 차단·ROI 없음 / Analyst·Executive: MG 노출·ROI 표시 |
| `passwordHash` 응답 포함 | ✅ 없음 (전 역할 차단 확인) |
| 단계 변경 권한 (US-007) | ✅ Executive 403 / Scout 200 |
| 사용자 관리 권한 | ✅ Scout 403 / Executive 200 |
| **마지막 경영진 보호 (US-029)** | ✅ 2명→1명 강등 200, 마지막 1명 강등 시도 **409 LAST_EXECUTIVE** |
| 체류 일수 불변식 (화면) | ✅ "총합 = 등록 후 경과" **일치** |
| 대시보드 위젯 | ✅ 병목 구간·라인업 갭 렌더링 |
| 최종 typecheck / tests | ✅ 오류 0건 / 26개 전부 통과 |

### 2차 검증에서 발견해 고친 결함 2건
4. **`npm run db:seed`가 `.env`를 읽지 못함** — Prisma CLI는 `.env`를 자동 로드하지만 `tsx`는 하지 않아 `DATABASE_URL` 부재로 실패. 사용자가 문서대로 따라 하면 반드시 막히는 지점. `tsx --env-file-if-exists=.env`로 수정 (docker compose는 환경변수를 직접 주입하므로 파일 부재 시에도 동작).
5. **세션 쿠키의 `secure` 플래그를 `NODE_ENV`로 판정** ⚠️ **가장 심각** — `next start`는 `NODE_ENV=production`이므로 쿠키에 `Secure`가 붙고, `http://localhost` 접속 시 브라우저가 쿠키를 되돌려 보내지 않는다. **로그인은 200을 받지만 세션이 유지되지 않아 즉시 로그인 화면으로 되돌아간다.** NFR-002가 전제하는 로컬 http 실행 환경 전체가 사용 불가 상태였다. 실제 요청 프로토콜(`x-forwarded-proto` 우선, 없으면 `request.url`)로 판정하도록 수정.
   > 사용자가 보고한 "데모 계정 로그인 실패"의 실제 원인이 이것이었다. 문서 검토나 타입 검사로는 절대 드러나지 않고, 브라우저나 쿠키를 유지하는 클라이언트로 실제 요청을 보내야만 발견된다.

## 3차 구현·검증 — U4 완성 · U5 확장 (2026-07-25T17:30 KST 이후)

### 추가 구현
- **U4 완성**: `modules/deals/service.ts` (딜·판권·재무 쓰기, Analyst 전용), API `PUT /api/titles/[id]/deal`, `POST .../rights`, `GET·PUT .../financials`, 상세 화면의 딜·재무 편집 폼
- **U5 CSV 내보내기**: `modules/dataio/export-service.ts`, `GET /api/export/titles`, 목록 화면 내보내기 버튼. `serialize.ts`에 `gateExportRows()` 추가 — 컬럼마다 소속 엔티티를 선언해 컬럼 단위로 정책을 판정한다(작품+딜+재무가 한 행에 섞이므로 기존 단일 엔티티 게이트로는 부족했음)
- **U2 협업**: `modules/evaluation/service.ts` (평가 등록, 코멘트 + 멘션 알림 T4, 소유권 기반 삭제), API `POST /api/titles/[id]/comments`, 상세 화면 코멘트 폼(멘션 버튼 포함)
- **U5 알림**: `modules/dataio/notification-service.ts`, API `GET·POST /api/notifications`, `POST /api/notifications/scan`, 헤더 알림 센터

### 검증 결과 (실데이터)
| 검증 | 결과 |
|---|---|
| CSV 내보내기 컬럼 마스킹 | ✅ Scout **9컬럼** / Analyst **17컬럼**. 제외 컬럼 목록을 응답 헤더로 안내 |
| CSV 이스케이프 | ✅ 쉼표 포함 계약조건이 `"극장 우선 개봉, 홀드백 4개월"` 로 RFC 4180 인용 처리 |
| 재무 계산 (내보낸 값 검산) | ✅ MG 8억 + P&A 14억 + 기타 2억 = 24억, 매출 38억 → 손익 14억, ROI **58.33%**(버림) |
| 내보내기 권한 | ✅ Executive 403 (export:execute 없음) |
| 딜 편집 권한 | ✅ Scout 403 / Executive 403 / Analyst 200 |
| 검증 규칙 | ✅ 유효기간<제출일 400, 음수 금액 400, 판권 종료일=시작일 400 (전부 `fields` 배열 포함) |
| 멘션 알림 (T4) | ✅ 언급된 2명에게만 생성, **작성자 본인 0건**, 미언급자 0건 |
| 마감 스캔 중복 방지 | ✅ 1회차 생성 1 → 2·3회차 생성 0 / 스킵 1 |
| 최종 typecheck / tests | ✅ 오류 0건 / 26개 통과 |

### 3차에서 고친 결함 1건
6. **`validate()` 제네릭이 변환 스키마를 거부** — `z.ZodType<T>`는 입력 타입까지 `T`로 고정하므로, 문자열을 `bigint`로 변환하는 금액 스키마가 타입 검사에서 통과하지 못했다. 입력·출력 타입을 분리한 `z.ZodType<TOut, ZodTypeDef, TIn>`로 수정.

## 4차 구현·검증 — 전 유닛 완료 (2026-07-25T17:40 KST 이후)

### 추가 구현
- **U2 완성**: `modules/titles/service.ts` (작품 생성 T3 — 생성과 최초 이력 append를 하나의 트랜잭션으로, 수정은 단계 변경 경로를 배제, 삭제 T2), `/titles/new` 등록 화면(중복 후보 사전 조회 → 경고), 평가 입력 폼, API `POST·GET /api/titles`, `PATCH·DELETE /api/titles/[id]`, `POST /api/titles/[id]/evaluations`
- **U5 CSV 가져오기**: `modules/dataio/import-service.ts` (템플릿 · 미리보기 · 반영 T5), `/titles/import` 화면, API `GET·POST /api/import/titles`
- **U5 리포트**: `modules/dataio/report-service.ts` (3종), `/reports` 목록과 `/reports/[kind]` 인쇄용 화면, API `GET /api/reports/[kind]` (Excel용 BOM CSV)
- 네비게이션을 `canPerform` 기반으로 변경 — 권한 없는 메뉴는 표시하지 않음

### 검증 결과
| 검증 | 결과 |
|---|---|
| 작품 등록 권한 | ✅ SCOUT 201 / ANALYST 403 / EXECUTIVE 403 |
| 평가 등록 권한 | ✅ SCOUT 201 / ANALYST 403 / EXECUTIVE 403 |
| **T3 트랜잭션** | ✅ 등록 즉시 `fromStage=null` 최초 이력 1건 생성 확인 |
| 입력 검증 | ✅ 장르 0개 400, 연도 1800 400, 점수 6 400 (전부 필드별 사유) |
| CSV 미리보기 | ✅ 5행 중 정상 2 · 오류 3을 **행 번호·컬럼·사유**로 반환, **저장 없음** |
| CSV 전체 반영 | ✅ 오류 행 존재 시 400으로 거부, 행별 사유 반환 |
| CSV 정상행만 반영 | ✅ imported 2 / skipped 3, 작품 수 27→29 |
| CSV 가져온 작품의 이력 | ✅ `note='CSV 가져오기'` 최초 이력 생성 (개별 등록과 동일) |
| CSV 인용 처리 | ✅ 쉼표·따옴표 포함 시놉시스가 정확히 복원됨 |
| 리포트 권한 | ✅ SCOUT 403 / ANALYST 200 / EXECUTIVE 200 |
| 리포트 3종 | ✅ BOM 포함 CSV 생성, 머리말에 생성 시각·생성자 |
| 인쇄용 화면 3종 | ✅ 생성 시각·생성자 표시, 인쇄 버튼 동작 |
| 최종 typecheck / tests / build | ✅ 오류 0건 / 26개 통과 / 빌드 성공 |

### 4차에서 확인된 것 — 코드 결함 아님
검증 중 "Analyst가 작품 등록에 201을 받는" 현상을 발견했으나, 원인은 **사용자가 실행 중인 앱의
사용자 관리 화면에서 역할을 변경했기 때문**이었다(analyst@fad.local → SCOUT, exec1 → ANALYST).
즉 "이메일이 곧 역할"이라고 가정한 검증 스크립트가 틀린 것이지 권한 코드는 정상이었다.
역할을 시드값으로 원복한 뒤 세션이 반환한 실제 역할로 재판정하니 전부 기대대로 동작했다.
> 교훈: 권한 검증은 이메일이 아니라 **로그인 응답의 role**을 기준으로 판정해야 한다.

### 설계와의 의도적 차이 (US-025 PDF)
요구사항은 "PDF는 서버에서 생성하며 한글이 깨짐 없이 렌더링"이었으나, 서버 생성은 한글 TTF를
저장소에 포함해야 하므로(수 MB) 로컬 프로토타입에서 비용 대비 이득이 없다고 판단해
**인쇄용 화면 + 브라우저 인쇄(PDF로 저장)** 로 대체했다. 수용 기준(한글 깨짐 없음, 머리말에
생성 시각·생성자)은 만족하나 **생성 주체가 서버가 아니라 클라이언트**라는 점이 다르다.
`/reports` 화면과 `report-service.ts` 주석, README에 모두 명시했다.

## 5차 구현·검증 — 잔여 화면 완성 (2026-07-26)

### 추가 구현
- **작품 수정·삭제 화면**: `titles/[id]/title-edit.tsx` — 수정 폼과 2단계 삭제 확인(하위 데이터가 있으면 경고 문구가 달라짐). 단계 변경은 의도적으로 제외하고 그 이유를 화면에 명시("이력이 남지 않는 경로를 만들지 않기 위해")
- **판권 섹션·입력 폼**: `titles/[id]/rights-section.tsx` — 상세 화면에 판권이 표시조차 되지 않던 것을 보완. 영토 14종 다중 선택, 만료 D-day 배지, 등록은 Analyst만

### 검증 결과
| 검증 | 결과 |
|---|---|
| 작품 수정 권한 | ✅ SCOUT 200 / ANALYST 403 / EXECUTIVE 403 |
| 작품 삭제 권한 | ✅ SCOUT 200 / ANALYST 403, 삭제 후 조회 시 결과 없음 |
| 판권 등록 권한 | ✅ ANALYST 201 / SCOUT 403 / EXECUTIVE 403 |
| 겹치는 판권 저장 | ✅ 201 — 충돌 검증은 범위 밖이라는 설계대로 차단하지 않음 |
| 최종 typecheck / tests / build | ✅ 오류 0건 / **29개 통과** / 빌드 성공 |

### 5차에서 발견해 고친 결함 1건 ⚠️ 
7. **직렬화 게이트가 원시값 배열을 통째로 제거** — `serialize()`가 배열이면 무조건 "미등록 관계"로 보고 차단했다. 그 결과 `Title.genres`, `Title.cast`, `RightsGrant.territories`가 **모든 API 응답에서 조용히 사라졌다.**
   - 발견 경위: 작품 수정 API가 200을 반환했는데 응답의 `genres`가 비어 있어 DB를 직접 확인했더니 저장은 정상이었다. 즉 저장이 아니라 **응답 생성 단계의 결함**이었다.
   - 서버 렌더링 화면은 Prisma 결과를 직접 읽으므로 증상이 드러나지 않았다. API를 직접 호출해야만 보이는 종류의 결함이다.
   - 원인: "미등록 관계는 차단"이라는 안전 규칙이 의도보다 넓게 적용됐다. 원시값 배열은 관계가 아니라 필드다.
   - 수정: `isRelationLike()`로 판정을 분리 — 객체는 관계, 배열은 **원소가 객체일 때만** 관계. 빈 배열은 필드로 취급.
   - 회귀 방지: 단위 테스트 3건 추가(원시값 배열 유지 / 빈 배열 유지 / 미등록 객체 배열은 여전히 차단). 테스트 26 → 29개.

### 남은 미구현
없음 — U1~U5의 모든 스토리에 대응하는 화면과 API가 존재한다.
다만 다음은 설계상 범위 밖이거나 의도적 대체다: 판권 충돌 검증(범위 밖), 이메일 발송(범위 밖),
서버 PDF 생성(인쇄 화면으로 대체), 스케줄러(수동 스캔 트리거로 대체).

### 검증 중 생성된 테스트 데이터
`권한검증`(3건), `검증용 신작`, `수입 검증작 A/B` 등이 DB에 남아 있다. 시연에 방해되면 삭제해도 무방하다.

### 로컬 실행 환경 (검증에 사용한 구성)
- PostgreSQL 17 서비스 실행 중 (포트 5432), 슈퍼유저 `postgres`
- 앱 DB: `fad` / 롤 `fad` (비밀번호는 `.env`의 `DATABASE_URL` 참조), `CREATEDB` 부여됨
- 앱 실행: `node --env-file=.env node_modules\next\dist\bin\next start -p 3100`
- Node는 PATH에 없을 수 있음: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*\node-v24.18.0-win-x64`

### PostgreSQL 설치 경과 (참고)
winget으로 `PostgreSQL.PostgreSQL.17` 설치를 시도했으나 EDB 설치 관리자가 10분 이상 진행 중 상태에서 `lib/` 디렉터리를 생성하지 못함(비대화형 셸에서 UAC 승격 대기로 추정). 수동 `initdb`도 `$libdir/dict_snowball` 부재로 실패. Docker Desktop 또는 관리자 권한 PostgreSQL 설치가 필요하다.

## Workspace State
- **Existing Code**: No
- **Programming Languages**: None detected
- **Build System**: None detected
- **Project Structure**: Empty (AI-DLC rule assets only)
- **Reverse Engineering Needed**: No
- **Workspace Root**: c:\Users\804\Documents\workspace\20260725

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | No | Requirements Analysis |
| Property-Based Testing | Partial — pure functions and serialization round-trips only | Requirements Analysis |
| Resiliency Baseline | No | Requirements Analysis |

**Note**: Security Baseline is provisionally disabled per Q18=B, but Clarification Question 2 may change this if the user selects option C (full authentication implementation). Full rule files for disabled extensions are NOT loaded.

## Stage Progress

### 🔵 INCEPTION PHASE
- [x] Workspace Detection
- [ ] Reverse Engineering — SKIPPED (greenfield, no existing code)
- [x] Requirements Analysis — COMPLETE (approved by user 2026-07-25T06:04:00Z)
- [x] User Stories — COMPLETE (approved by user 2026-07-25T06:28:00Z)
- [x] Workflow Planning — COMPLETE (approved by user 2026-07-25T06:36:00Z)
- [x] Application Design — COMPLETE (approved by user 2026-07-25T06:52:00Z)
- [x] Units Generation — COMPLETE (approved by user 2026-07-25T07:14:00Z)

**🔵 INCEPTION PHASE COMPLETE** — 6 stages executed, 1 skipped (Reverse Engineering)

### 🟢 CONSTRUCTION PHASE — per-unit loop (5 units, sequential)

**Unit order**: U1 Foundation & Auth → U2 Title & Evaluation → U3 Pipeline → U4 Deal & Financials → U5 Dashboard & Reports

- [ ] **U1 Foundation & Auth** (7 stories) — Functional Design **IN PROGRESS** (plan presented, awaiting answers to 8 questions) → Code Gen Planning → Code Gen
- [ ] **U2 Title & Evaluation** (8 stories) — Functional Design → Code Gen Planning → Code Gen
- [ ] **U3 Pipeline** (4 stories) — Functional Design → Code Gen Planning → Code Gen
- [ ] **U4 Deal & Financials** (5 stories) — Functional Design → Code Gen Planning → Code Gen
- [ ] **U5 Dashboard & Reports** (8 stories) — Functional Design → Code Gen Planning → Code Gen
- [x] **Build and Test — COMPLETE** (approved by user 2026-07-26T01:00:00Z)

## 6차 — NFR-009 충족 및 통합 테스트 자동화 (2026-07-26)

Build and Test에서 남긴 미해결 항목 중 두 가지를 처리.

### 1) NFR-009 위반 해소 — 키보드로 단계 변경
초기 구현은 드래그 앤 드롭만 있어 *"단계 변경은 키보드만으로 조작 가능"* 요구사항을 위반했다.
칸반 카드에 **네이티브 `<select>`** 를 추가. 커스텀 드롭다운 대신 네이티브를 쓴 이유는
키보드·스크린 리더·터치가 전부 기본 지원되기 때문. `sr-only` 라벨로 어느 작품의 컨트롤인지
읽히게 했고, 결과 안내에 `role="status" aria-live="polite"`를 달았다.
드래그와 셀렉트가 **같은 `moveTo()` 경로**를 쓰므로 한쪽만 이력을 빠뜨리는 일이 없다.

### 2) 통합 테스트 자동화 — S1·S2·S4
`tests/integration/` + `vitest.integration.config.ts` + `npm run test:integration`.
**23개 전부 통과** (약 2.4초). 기본 `npm test`와 분리 — 서버·DB가 필요해 섞으면 환경이 없는
곳에서 전부 실패하고 순수 로직의 회귀 신호까지 묻힌다.

핵심 규칙: 역할은 **로그인 응답의 `role`로 판정**(이메일 가정은 실제로 오진을 냈음),
세 역할이 확보되지 않으면 즉시 중단, 픽스처는 자기가 만들고 자기가 지움.

### 6차에서 발견해 고친 결함 2건
8. **`BASE_URL` 이름이 Vite 내장 변수와 충돌** — Vite가 `BASE_URL`을 `"/"`로 미리 정의해
   요청 URL이 `//api/...`로 깨졌다. `FAD_BASE_URL`로 변경.
9. **BOM 테스트가 무의미했음** ⚠️ — 기존 단위 테스트가 `startsWith("﻿")`로 검사했는데,
   소스의 BOM 리터럴이 빈 문자열이 되어도 `"abc".startsWith("")`가 `true`라 **BOM이 없어도
   통과**했다. 통합 테스트에서 같은 검사가 실패해 드러났다. 원인을 파보니 실제로는
   `Response.text()`가 규격상 선두 BOM을 제거하는 것이었고(BOM은 정상 전송 중),
   **테스트 두 개가 모두 잘못**이었다. 단위는 `charCodeAt(0) === 0xFEFF`로,
   통합은 응답 **바이트**의 첫 3바이트가 `EF BB BF`인지로 바꿨다.
   > 통과하는 테스트가 아무것도 검증하지 않을 수 있다는 사례.

## 7차 — 성능 목표 규모 검증 (2026-07-26)

Build and Test에서 유일하게 ⚠️ 조건부였던 판정을 확정으로 바꿨다.

### 도구 추가
- `scripts/bulk-titles.ts` — 목표 규모까지 증량. 고정 시드로 결정론적 데이터 생성.
  `titleKo`가 `[대량]`으로 시작하므로 `--clean`으로 시드·사용자 데이터를 건드리지 않고 정리 가능
- `scripts/measure.ts` — 워밍업 1회 제외, 본문 수신 완료까지 계측, p95 산출
- `scripts/measure-import.ts` — CSV 가져오기 미리보기·반영 각각 계측

### 실측 결과 — **전 목표 충족** ✅

| 항목 | 목표 | 24편 | **500편** | 1,000편 | 예산 사용 |
|---|---|---|---|---|---|
| 작품 목록 p95 | 500ms | 59ms | **210ms** | 349ms | 42% |
| 대시보드 p95 | 2,000ms | 54ms | **121ms** | 170ms | 6% |
| CSV 가져오기 500행 | 10,000ms | — | **825ms** | — | 8% |

측정 후 976편(대량 476 + 가져오기 500)을 전부 정리해 24편 상태로 복구함.

### 예상이 빗나간 지점
문서가 "대시보드가 전 건을 메모리로 가져와 비선형 악화" 를 우려했으나, 데이터 **20.8배** 증가에
응답은 **2.2~3.6배**만 늘었다(선형보다 완만). 이 규모에서는 요청당 고정 비용이 지배적이기 때문.
다만 1,000편에서 목록이 예산의 70%를 쓰므로 **1,400~1,500편 부근이 한계로 추정**된다고 기록.

> 미리 최적화하지 않고 측정한 판단이 옳았다. 우려했던 네 지점 모두 손대지 않았고,
> 손댔다면 불필요한 복잡도만 늘었을 것이다.

## 8차 — 딜·재무 저장 원자성 (2026-07-26)

문서에 "알려진 한계"로 기록해뒀던 데이터 정합성 결함을 해소했다.

### 문제
화면의 딜·재무 편집 폼이 `/deal`과 `/financials`를 **순차 호출**했다. 딜이 저장된 뒤 재무가
실패하면 사용자는 "저장 실패"를 보지만 딜은 이미 바뀌어 있어 무엇이 반영됐는지 알 수 없었다.

### 해결
- `saveDealAndFinancials()` — `runInTransaction`으로 두 upsert를 묶음
- `dealWithFinancialsSchema` — 중첩 스키마. **검증이 트랜잭션보다 먼저** 일어나므로
  어느 한쪽이 걸리면 양쪽 모두 저장되지 않는다
- `PUT /api/titles/[id]/deal-financials` — 화면이 쓰는 단일 엔드포인트
- 개별 엔드포인트는 부분 수정용으로 유지 (한쪽만 바꿀 때는 중간 상태가 성립하지 않음)

### 부수적 개선
재무 계산이 **같은 트랜잭션에서 방금 저장한 딜**을 기준으로 하도록 했다. 이전 딜로 계산하면
MG를 바꾼 즉시의 응답이 옛 값 기준이 되어 화면과 어긋난다.

### 검증
`tests/integration/deal-atomicity.test.ts` 6건 추가. 핵심은 **유효한 딜 + 음수 재무를 함께
보낸 뒤 400을 받고 딜이 이전 값 그대로인지** 확인하는 것 — 나뉜 API였다면 딜이 이미
저장됐을 상황이다. 통합 테스트 23 → **29개**.

### 부수 수정
중첩 스키마라 오류 경로가 `deal.minimumGuarantee` 형태가 되어, 폼의 `issueFor`가 마지막
마디로 매칭하도록 변경.

## 9차 — Notification 중복 방지의 NULL 구멍 (2026-07-26)

문서에 "잠복 상태"로 기록해둔 결함을 **발현되기 전에** 제거했다.

### 문제
`@@unique([userId, type, titleId, marker])` 에서 `titleId`가 nullable이다.
PostgreSQL은 `NULL != NULL` 이므로 **titleId가 NULL인 행에는 이 제약이 걸리지 않는다.**
같은 (userId, type, marker) 조합이 무제한 삽입 가능했다.

현재는 세 유형 모두 작품에 연결되어 증상이 없었지만, 시스템 공지 같은 알림이 추가되는
순간 중복 방지가 조용히 무력화되는 구조였다.

### 해결
- `src/domain/notification-key.ts` 신설 — 키 생성을 순수 함수로 분리.
  `mentionKey` / `deadlineKey` / `systemKey`. 작품이 없으면 `-` 자리표시자를 넣어
  **키 자체는 항상 존재**한다
- 스키마: `dedupeKey String` (NOT NULL) 추가, `@@unique([userId, dedupeKey])`로 교체
- `marker`는 **화면 표시용**으로 역할 축소 — 중복 판정과 표시를 한 컬럼이 겸하던 것을 분리
- 마이그레이션 `20260726010000_notification_dedupe_key` — 기존 3행이 있어 nullable 추가 →
  백필 → NOT NULL → 구 제약 제거 → 신 제약 생성 순으로 **직접 작성**

### 검증
| 층위 | 방식 | 결과 |
|---|---|---|
| 순수 함수 | 단위 테스트 9건. `null`·`undefined`가 같은 키로 수렴하는지 포함 | ✅ |
| **DB 제약** | `titleId`가 NULL인 행 2건을 같은 키로 **직접 INSERT** | ✅ UNIQUE 위반으로 거부 |
| 통합 | 스캔 반복 시 알림 총수 불변, 멘션 2회 언급 시 알림 1건 | ✅ |

> DB에 직접 INSERT해 확인한 것이 핵심이다. 애플리케이션은 항상 `titleId`를 넣으므로
> 코드를 통해서는 이 경로를 재현할 수 없다. **결함이 있어도 앱을 아무리 조작해도
> 드러나지 않는 종류였다.**

### 환경 이슈
Prisma `migrate dev`가 shadow database 처리 중 `pg_signal_backend` 권한 부족으로 실패.
로컬 개발용으로 `GRANT pg_signal_backend TO fad;` 부여. 또한 비대화형 셸에서는 NOT NULL
컬럼 추가를 거부하므로 마이그레이션을 직접 작성해 `migrate deploy`로 적용했다.

### 테스트 규모
단위·속성 29 → **38개** (알림 키 9건 추가)
통합 29 → **32개** (S7 중복 방지 3건 추가)

## 10차 — 통합 시나리오 전면 자동화 (2026-07-26)

S3·S6·S8·S9·S10을 자동화해 **10개 시나리오 전부**가 자동 검증된다.

| 파일 | 시나리오 | 테스트 |
|---|---|---|
| masking / export / financials-consistency | S1·S2·S3 | 8·7·6 |
| pipeline | S4·S5 + NFR-009 | 9 |
| mention / notification-dedupe / import | S6·S7·S8 | 7·3·7 |
| last-executive / permissions / deal-atomicity | S9·S10·S11 | 5·31·6 |

**통합 89개 · 단위·속성 38개 = 127개 전부 통과** (통합 7.8초)

### 자동화 설계에서 정한 것
- **권한 매트릭스(S10)가 데이터를 만들지 않는다** — 차단 역할은 403, 허용 역할은 "403이 아님"으로
  판정. 대부분 존재하지 않는 ID를 써서 404로 끝난다. 예외인 작품 등록만 생성분을 정리
- **역할을 바꾸는 테스트(S9)의 이중 복구** — `afterAll` + 마지막 테스트가 복구를 명시 검증.
  복구 실패 시 이후 모든 권한 테스트가 거짓 실패하기 때문
- 픽스처 이름을 `[통합테스트]`로 시작시켜 중단 시 식별 가능하게 함

### 10차에서 발견해 고친 결함 1건 ⚠️
10. **단계 이력에 변경자와 사유 메모가 표시되지 않았다** — US-008의 수용 기준은
    *"이전 단계, 이후 단계, **변경자, 변경 시각, 사유 메모**가 시간순으로 표시된다"* 인데
    화면은 단계·날짜·일수만 보여줬다. `note`와 `changedById`는 **저장은 되고 있었으나 한 번도
    화면에 나오지 않았다.**
    - 발견 경위: CSV 가져오기 테스트가 최초 이력의 `note`("CSV 가져오기")를 화면에서 찾다 실패
    - 함께 발견: 갓 등록한 작품에 `발굴` 행이 **두 번** 찍혔다. 최초 이력의 `occurredAt`이
      `createdAt`과 같아 **길이 0의 중복 구간**이 생기는데, 계산에는 필요하지만 화면에는 노이즈다
    - 수정: `findTitleDetail`에 `changedBy` 조인 추가, 이력 행에 변경자·사유 표시,
      진입과 이탈이 같은 순간인 구간은 표시에서 제외(**계산에는 그대로 포함** — 불변식 유지)
    - 회귀 방지: `pipeline.test.ts`가 사유를 남기며 단계를 옮긴 뒤 화면에 표시되는지 확인

> 수용 기준을 코드가 아니라 **화면에서** 확인하는 테스트가 아니었다면 드러나지 않았을 결함이다.
> API는 정상이었고 데이터도 정상이었다. 표시만 빠져 있었다.

## 11차 — NFR-009 명도 대비 검증 (2026-07-26)

### 방식
`src/domain/color-contrast.ts` 신설 — WCAG 2.1 상대 휘도·명도 대비 계산 (순수 함수).
`tests/unit/contrast.test.ts`가 **globals.css를 직접 파싱**해 라이트·다크 17개 조합을 검사.
팔레트를 테스트에 복제하면 소스가 바뀔 때 옛 값을 검사하며 통과하는 무의미한 테스트가 된다.

### 최초 측정에서 4개 조합 미달 → 팔레트 조정
| 토큰 | 변경 전 | 변경 후 | 대비 |
|---|---|---|---|
| 라이트 `--faint` | `#9C8E9C` 3.10 | `#7e707e` | 4.66 |
| 라이트 `--good` | `#2E7D5B` 4.29 | `#297856` | 4.60 |
| 라이트 `--warn` | `#B26B08` 3.66 | `#a15a00` | 4.61 |
| 다크 `--faint` | `#7A6C7A` 3.53 | `#8d7f8d` | 4.61 |

값은 추측하지 않고 **색조를 유지한 채 명도만 조정해 목표를 처음 만족하는 값을 탐색**해 정했다.

### `--line` / `--line-strong` 분리
WCAG 1.4.11은 "컴포넌트를 **식별하는 데 필요한**" 시각 정보에만 3:1을 요구한다.
- 카드 테두리 → 장식. 카드는 내용과 여백으로 식별된다 → `--line` 유지 (1.33:1)
- 입력·셀렉트·버튼 테두리 → 어디에 입력하는지 알려주는 필수 정보 → `--line-strong` 신설 (3.06:1)

모든 테두리를 3:1로 올리면 화면이 과도하게 무거워진다. **기준을 완화한 것이 아니라 적용
대상을 정확히 구분한 것.** `--line-strong`은 카드가 아니라 입력 자체의 배경(`--surface-2`)
기준으로 맞췄다 — 테두리가 실제로 놓이는 곳이 거기다.

### 대가
`--faint`가 `--muted`에 가까워져 시각적 위계가 좁아졌다. 접근성을 위해 감수했다.

### 테스트 규모
단위·속성 38 → **76개** (대비 38건 추가)

### 남은 항목
- ~~NFR-003 브라우저 호환 실측~~ — **완료** (2026-07-26, 사용자 Chrome·Edge 실측)
  → **NFR-001~009 전 항목 검증 완료**

---

## 12차 — U6 인수 판단 근거 요구사항 (2026-07-26) ⏳ 승인 대기

사용자가 "영화가 왜 선택되는가"를 다루는 의사결정 도구를 제안. 검토 후 증분 요구사항 문서
`inception/requirements/requirements-u6-signals.md` 작성.

### 제안 6개 항목에 대한 판정
| 제안 | 판정 |
|---|---|
| 1) 영화제 초청·수상·프리미어 | 부분 채택 — `FestivalRecord` 이미 존재, **프리미어 구분만 신규** |
| 2) 세일즈 셀링 포인트 | 채택 |
| 3) 해외 리뷰 톤·키워드 | 채택 (독립 신호로 분리) |
| 4) 트레일러 반응 | 조건부 — 시점 관측으로만 |
| 5) 유사작 성과 | **채택, 최우선** — 유일하게 반증 가능한 신호 |
| 6) 시사 메모·스코어카드 | **기각** — `Evaluation` + `Comment`가 이미 커버 |

6번을 기각한 이유: 새 칸을 만들면 평가가 두 곳으로 갈라져 **단일 정의 지점 원칙**이 깨진다.

### 핵심 설계 결정
- **D-1** 신호는 추가만 되는 관측. `updatedAt` 없음. `StageTransition`과 동일하게 메서드
  부재로 차단. 근거: 사후 검토에 필요한 것은 "지금 사실"이 아니라 "결정 시점에 알던 것"
- **D-2** **Heat에 종합 점수를 만들지 않는다** (FR-035, 금지 규칙). ROI는 반증 가능하지만
  Festival heat는 영원히 반증 불가능하며, 사람들은 숫자로 정렬한다
- **D-3** 출처 등급은 신뢰도가 아니라 **법적 지위**. `INTERNAL`(NDA 시사 메모)은 모든
  내보내기 경로에서 전면 차단(FR-033), `SEMI_PUBLIC`은 실명 금지·조직명까지만(FR-034)

### 배치 결정
Heat 카드는 대시보드가 아니라 **작품 상세**에 둔다(FR-040). 현재 위젯은 "처리해야 할 일",
Heat는 "생각해야 할 것" — 섞으면 둘 다 흐려진다.

### 산출
FR-025~041 (17개) · NFR-010 · 신규 엔티티 2종 · 가정 A-U6-1~5 · 미해결 질문 Q-U6-1~5

### 답변 확정 (2026-07-26)
Q-U6-1=**B**(작성자 본인 포함) · Q-U6-2=**A**(3단계) · Q-U6-3=**B**(KOBIS 링크) ·
Q-U6-4=**A**(트레일러 포함) · Q-U6-5=**C**(Heat 카드 이월)

### 답변 반영 중 발견 — 행 단위 권한이 없다
**Q-U6-1=B는 기존 권한 구조로 표현할 수 없습니다.** `canReadField(role, entity, field)`는
`userId`를 받지 않아 "작성자 본인"을 판정할 자리가 없습니다.

| 안 | 판정 |
|---|---|
| 정책 함수에 `userId` 추가 | ❌ 12 Action + 8 엔티티 전체 서명 변경. 필요한 곳은 `Signal` 하나 |
| 서비스 계층 후처리 필터 | ❌ 거르지 않는 경로가 새로 생기면 조용히 샌다 |
| **리포지토리 질의 `WHERE`** | ✅ 채택. 걸러지지 않은 배열이 메모리에 존재하지 않는다 |

**BR-U6-005**: `Signal` 리포지토리는 `ctx`를 받지 않는 조회 메서드를 제공하지 않는다.
`StageTransition`의 append-only와 같이 **규율이 아니라 부재로 강제**한다.

### 스스로 낮춘 요구사항
원안 FR-034 "개인 실명 저장 금지"를 **경고 + 운영 규칙**으로 낮췄습니다. 자유 텍스트에서
인명을 판별할 신뢰할 방법이 없어 자동 검증이 불가능한데, **검증하는 척하는 규칙은 없는
규칙보다 나쁩니다** — 통과했으니 안전하다고 믿게 만들기 때문입니다.

### 상태
✅ **요구사항 승인.** C-U6-1 해제 완료 → 15차로 이어짐

---

## 15차 — U6 Functional Design (2026-07-27) ⏳ 승인 대기

### 질문 답변
Q-FD-1~4 전부 **권장안(A)**: 철회 권한에 작성자 본인 포함 · 키워드 자유 입력 ·
유사작 등록에 Scout 포함 · 근거 탭은 종류 필터만

### 산출 문서 4종
`construction/u6-acquisition-signals/functional-design/`
domain-entities.md · business-rules.md · business-logic-model.md · frontend-components.md

**U2~U5와 달리 구현 전에 작성했습니다.** 원래 순서를 회복했습니다.

### 설계에서 결정한 것 중 기록할 것

**1. `updatedAt`을 두지 않는다**
수정되지 않는 테이블이라는 사실이 스키마에 드러나야 합니다. 습관적으로 달아두면 나중에
읽는 사람이 "수정되는 테이블"로 이해하고 수정 경로를 만듭니다.

**2. `sourceGrade`에 기본값을 두지 않는다**
기본값이 있으면 등급을 고르지 않은 관측에 조용히 `PUBLIC`이 붙습니다.
**가장 위험한 실수가 가장 조용히** 일어납니다. 화면의 선택 초기값도 비워 둡니다.

**3. `FestivalRecord.premiereStatus`를 백필하지 않는다**
`NONE`으로 채우면 **모르는 것을 "해당 없음"으로 단정**합니다.
`null`은 "아직 기록하지 않음", `NONE`은 "프리미어가 아님" — 다른 뜻입니다.

**4. 권한 없는 관측에 403이 아니라 404를 준다**
403은 "있지만 못 본다"를 알려주어 **존재 자체가 새어 나갑니다.**
로그인 실패에서 계정 존재를 감춘 것(BR-U1-002)과 같은 판단입니다.

**5. 검증 함수는 던지지 않고 문제 배열을 반환한다**
첫 오류에서 던지면 사용자가 고칠 때마다 다음 오류를 새로 만납니다.

**6. 종류별 필수 필드를 `Record<SignalKind, ...>` 표로 둔다**
`if/else` 분기로 쓰면 종류를 추가할 때 검증을 잊습니다. 표는 **컴파일러가 빈칸을 지적**합니다.

**7. 근거 섹션에 탭을 만들지 않는다**
현재 상세 화면은 카드가 세로로 이어지는 구조입니다. 탭 하나만 도입하면 같은 화면에 두
가지 탐색 방식이 생겨 어디에 뭐가 있는지 예측할 수 없게 됩니다.

**8. 철회에 취소선을 쓰지 않는다**
긴 한글에 취소선을 그으면 읽을 수 없는데, 철회 사유를 이해하려면 원문을 읽어야 합니다.

**9. 신규 색 토큰을 만들지 않는다**
만들면 `contrast.test.ts`의 검사 쌍에 추가해야 하고, 잊으면 검사되지 않는 색이 생깁니다.

### 테스트 설계
단위 9건(도메인 순수 함수) · 통합 26건(S11~S15).
**S13이 핵심** — NFR-010을 3역할 × 3형식 전수로 확인합니다. Executive도 `INTERNAL`을
내보낼 수 없다는 것을 명시적으로 검사해야 "관리자니까 되겠지"라는 구현이 들어오지 않습니다.

**PBT는 붙이지 않습니다** — NFR-007이 순수 계산과 직렬화 왕복으로 한정했고, 검증 규칙은
표로 열거하는 편이 성질을 만드는 것보다 정확합니다.

### 여전히 남는 공백
**UI 배선은 검사되지 않습니다.** 결함 10·11이 그 공백에서 나왔습니다.
`frontend-components.md` 9절에 **화면에서 손으로 확인할 14개 항목**을 명시했습니다.
E2E 도입 전까지는 그게 최선입니다.

### 상태
⏳ **승인 대기.** 승인 시 Code Generation (Part 1: 계획)

---

## 13차 — 결함 11: 단계 변경 사유 입력 UI 부재 (2026-07-26)

사용자가 브라우저 점검 중 발견. **10번을 고칠 때 표시 경로만 고치고 입력 경로를 확인하지
않은 것이 원인**입니다.

### 경로 진단
| 구간 | 상태 |
|---|---|
| `StageTransition.note` 스키마 | ✅ |
| `changeStage(ctx, id, toStage, note?)` | ✅ |
| `POST /api/pipeline/{id}/stage` 검증 | ✅ |
| 이력 행 렌더링 | ✅ (10번에서 고침) |
| **칸반 입력 UI** | ❌ **없음** |

`moveTo()`가 `{ toStage }`만 보내고 있었습니다. 양 끝은 멀쩡한데 중간이 끊겨 사용자가 남긴
사유는 **존재할 수 없었습니다.**

### 수정 — append-only가 상호작용 형태를 결정했다
이력은 기록 후 수정할 수 없으므로 **사유를 나중에 붙일 수 없습니다.** 따라서 이동을 즉시
기록하지 않고 확정 단계를 하나 넣었습니다.

```
드래그 또는 셀렉트 → PendingMove 상태 → 사유 입력(선택) → [이동 기록] → POST
```

두 입력 방식이 `requestMove()` 하나로 모이는 기존 구조는 유지했습니다.

**사유를 필수로 하지 않았습니다.** 모든 이동에 필수 입력을 걸면 사람들은 `.` 이나 `이동`을
칩니다. 그건 빈 값보다 나쁩니다 — 데이터처럼 보이기 때문입니다.

### 곁가지로 고친 것
`textarea`에 기본 스타일이 없어 WCAG 입력 테두리 대비(`--line-strong`)가 적용되지 않는
사각지대가 있었습니다. `input, textarea`로 묶었습니다. 지금까지 앱에 `textarea`가 하나도
없어서 드러나지 않았습니다.

### 테스트 구조의 사각지대 (중요)
**통합 테스트로는 이 결함을 잡을 수 없습니다.** `pipeline.test.ts`는 API에 `note`를 직접
실어 보내므로 API 계약이 정상이면 통과합니다. **화면에 그 값을 보낼 수단이 있는지는 아무도
검사하지 않습니다.**

현재 테스트 계층은 도메인(순수 함수)과 HTTP(통합)뿐이고 **UI 배선 계층이 없습니다.**
결함 10·11이 연달아 사람이 화면을 봐야만 드러난 이유입니다. → E2E 도입 우선순위 상향.

### 검증
typecheck 0건 · 단위·속성 76/76 · build 성공 · 통합 89/89

### 후속 — "이력에 변경자·사유가 안 보인다" 신고 (표현 문제)
사용자가 사유를 저장했는데도 상세 화면에서 보이지 않는다고 신고. 조사 결과:

| 확인 | 결과 |
|---|---|
| DB `note` 값 | ✅ `"test"` 저장됨 |
| 서버 렌더 HTML | ✅ `<span class="hmeta">이분석 · test</span>` 출력됨 |

**기능은 정상이었고 표현이 문제였습니다.** 11px 흐린 회색으로 단계명 바로 아래 붙고,
라벨이 없고, 사유가 가운뎃점 뒤에 이어 붙어 **찾을 수가 없었습니다.**

수정: 사유를 변경자와 분리해 별도 줄로 띄우고 `사유` 접두 라벨과 좌측 강조선을 부여
(`.hnote`). 변경자는 `.hmeta`로 유지.

> **못 찾으면 없는 것과 같습니다.** 렌더링된다는 사실이 반박 근거가 되지 않습니다.

### 진단 과정에서의 자기 정정
최초 HTML 점검에서 `hmeta 등장: 0`이 나와 렌더링 실패로 볼 뻔했으나, 실제 원인은 **점검
스크립트가 잘못된 이메일(`analyst@example.com`)로 401을 받아 로그인 화면으로 리다이렉트된
것**이었습니다. 올바른 계정(`analyst@fad.local`)으로 재확인해 정정했습니다.
**도구가 실패한 것을 대상이 실패한 것으로 읽을 뻔했습니다.**

### 다크 모드 — 요구사항 밖이었으나 추가 (14차로 이어짐)
최초 신고 시에는 **요구사항에 다크 모드가 없다**고 답했습니다 (NFR-003은 브라우저·해상도,
NFR-009는 대비·키보드만 규정). 두 벌 팔레트는 제가 임의로 추가한 것이고
`prefers-color-scheme`로 OS 설정을 따랐습니다.

사용자가 재차 요청해 토글을 구현했습니다. 14차 참조.

---

## 14차 — 테마 토글 (2026-07-26) · 요구사항 확장

### 왜 그냥 버튼 하나가 아닌가
다크 팔레트가 `@media (prefers-color-scheme: dark)`에 걸려 있어, 토글이 이를 **덮어쓸
수단이 없었습니다.** 세 가지 방법을 검토했습니다.

| 안 | 판정 |
|---|---|
| `@media`와 `[data-theme="dark"]` 양쪽에 값 복제 | ❌ 두 벌을 적으면 한쪽만 고칠 때 조용히 어긋난다. **이 프로젝트에서 이미 겪은 실패 방식** |
| `light-dark()` CSS 함수 | ❌ 우아하지만 전 토큰 재작성이라 회귀 위험이 크다 |
| **인라인 스크립트가 `data-theme`을 항상 확정** | ✅ 채택. `@media`를 지우고 정의를 한 벌만 둔다 |

### 구조
```
layout.tsx  인라인 스크립트(렌더 차단) → <html data-theme="light|dark">
globals.css :root(라이트) + :root[data-theme="dark"](다크)  ← 정의 한 벌
theme-toggle.tsx  시스템 → 라이트 → 다크 순환, localStorage 저장
```

**첫 페인트 전에 확정해야 합니다.** React 마운트 후에 정하면 한 프레임 동안 잘못된 테마가
번쩍입니다(FOUC). 그래서 컴포넌트가 아니라 렌더 차단 인라인 스크립트가 정합니다.

**실패 방향**: 스크립트가 죽으면 라이트로 떨어집니다 — 읽을 수 없는 화면이 되지 않는 쪽입니다.

### 배치
상단바(로그아웃 옆)와 **로그인 화면** 양쪽. 로그인이 첫 화면인데 거기서만 못 바꾸면
"버튼이 없다"로 읽힙니다.

### 대비 테스트 갱신
`contrast.test.ts`의 파서를 `@media (prefers-color-scheme: dark)` → `:root[data-theme="dark"]`로
변경. 여전히 `globals.css`를 직접 파싱하므로 팔레트 복제는 없습니다. 76/76 유지.

### 검증
typecheck 0건 · 단위·속성 76/76 · build 성공 · 통합 89/89
배포 산출물에서 확인: `themebtn` 존재 · 인라인 스크립트 존재 · `[data-theme=dark]` 존재 ·
`prefers-color-scheme` **잔존 없음**(중복 정의가 남지 않았다는 증거) · `color-scheme` 존재

### 📁 유닛별 문서 보완 (2026-07-26)
사용자가 `construction/` 아래에 U2~U5 폴더가 없음을 지적. 실제 누락이 맞음 —
U1의 Functional Design만 실행됐고 U2~U5는 시간 제약으로 단계 자체가 생략됨.
U1도 `frontend-components.md`(자기 계획서 C-5 항목)가 빠져 있었음.
→ 17개 문서를 보완하되 **as-built 기록**으로 명시. U2~U5는 설계가 코드보다 먼저 내려지지
않았으므로 문서를 나중에 쓴다고 그 순서가 복원되지는 않는다는 점을 각 문서에 기재.

**Skipped per-unit stages**: NFR Requirements · NFR Design · Infrastructure Design (see execution-plan.md §3)
**Total remaining approval points**: 16 (5 units × 3 + Build and Test)

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

## Execution Plan Summary
- **Artifact**: `inception/plans/execution-plan.md`
- **Total stages**: 14 · **Execute**: 8 · **Skip**: 4 · **Placeholder**: 1 · **In progress**: 1
- **Stages to execute**: Workspace Detection ✓, Requirements Analysis ✓, User Stories ✓, Workflow Planning ✓, Application Design, Units Generation, Functional Design (per unit), Code Generation (per unit), Build and Test
- **Stages skipped**: Reverse Engineering (greenfield), NFR Requirements (tech stack fixed + NFRs pre-quantified), NFR Design (follows), Infrastructure Design (local Docker Compose only)
- **Risk level**: Medium · **Rollback**: Easy · **Testing complexity**: Moderate
- **Anticipated units** (to be confirmed in Units Generation): Foundation & Auth → Title & Evaluation → Pipeline → Deal & Financials → Dashboard & Reports

## Requirements Analysis — Intent Analysis
- **Request Clarity**: Vague / Incomplete
- **Request Type**: New Project
- **Scope Estimate**: Multiple Components
- **Complexity Estimate**: Moderate
- **Requirements Depth**: Comprehensive
- **Artifacts**: `inception/requirements/requirement-verification-questions.md` (20 Q), `inception/requirements/requirements-clarification-questions.md` (5 Q), `inception/requirements/requirements.md`
- **Result**: 24 functional requirements (FR-001~FR-024), 9 non-functional requirements (NFR-001~NFR-009), 10 domain entities, 3 RBAC roles

## User Stories — Results
- **Artifacts**: `inception/plans/user-stories-assessment.md`, `inception/plans/story-generation-plan.md` (all 25 checklist items [x]), `inception/user-stories/personas.md`, `inception/user-stories/stories.md`
- **Methodology** (all Q1-Q8 = A): hybrid breakdown (epics by feature area, stories from persona perspective), medium granularity, standard narrative format, Given-When-Then acceptance criteria, selective NFR storification, practical personas with permission boundaries, Korean prose with English identifiers, full reverse traceability
- **Output**: 8 epics, 32 stories (US-001~US-032), 3 personas
- **Permission-branching stories**: 14 · **PBT-targeted stories**: 4 (US-008, US-016, US-020, US-022)
- **Traceability**: FR-001~FR-024 all mapped (no gaps); NFR-001~NFR-009 all handled (2 storified, 2 hybrid, 5 global constraints)
- **INVEST splits applied**: FR-005 → US-006/US-007, FR-011 → US-013/US-014, FR-013 → US-016/US-017, FR-023 → US-028/US-029

## Application Design — Results
- **Artifacts**: `inception/plans/application-design-plan.md` (all 35 checklist items [x]), `inception/application-design/` → components.md, component-methods.md, services.md, component-dependency.md, application-design.md
- **Decisions** (all Q1-Q8 = A): 3 layers + pure domain modules · REST Route Handlers · field-policy table + single serialization gate · repository interfaces · feature-area component boundaries · shared Zod schemas · explicit transactional history recording · domain error types with single HTTP mapping
- **Structure**: 8 feature components (C1-C8), 6 platform components (X1-X6), 6 pure domain modules (D1-D6), 7 repositories, 17 services (S1-S17)
- **Key safety mechanisms**: unregistered fields default to BLOCKED in the policy table; `StageTransitionRepository` has no update/delete methods (append-only enforced at compile time); services read role only from `ctx` (cannot be forged by callers); serialization gate runs BEFORE file generation on export paths
- **Transaction boundaries**: T1-T7 defined
- **Verification**: 32/32 stories mapped · no dependency cycles · no inward-only violations · 7 design-violation criteria documented for code review

## Units Generation — Results
- **Artifacts**: `inception/plans/unit-of-work-plan.md` (all 26 checklist items [x]), `inception/application-design/` → unit-of-work.md, unit-of-work-dependency.md, unit-of-work-story-map.md
- **Decisions** (all Q1-Q9 = A): decompose along feature-component boundaries · 5 units · all shared code (X1-X6, D1-D6) in the first unit · sequential development · single-person execution · "runs and passes tests" completion criterion · deal/rights/financials as one unit · feature-first directories · directory separation without lint enforcement
- **Units**: U1 Foundation & Auth (7 stories) → U2 Title & Evaluation (8) → U3 Pipeline (4) → U4 Deal & Financials (5) → U5 Dashboard & Reports (8)
- **Note on unit sizing**: actual distribution is 4-8 stories rather than the 6-7 target; functional cohesion was prioritized over even story counts (documented in unit-of-work.md §2)
- **Key sequencing insight**: all 17 PBT properties are verified in U1 at the pure-function level, before any UI exists — so if a later unit shows a wrong value, the cause is known to be the data path, not the calculation
- **U4 is the masking proving ground**: all 5 of its stories are permission-branching; this is where U1's field policy and serialization gate are first exercised on real data
- **Verification**: 32/32 stories assigned (no gaps, no duplicates) · no unit dependency cycles · app is runnable at all 5 completion checkpoints
- **U3 ↔ U4 order is swappable** (no dependency between them) — swap if verifying masking correctness earlier is preferred

## Key Decisions
- **Project nature**: Personal learning / portfolio PoC, local-only execution
- **Tech stack**: Next.js (App Router) + TypeScript fullstack, Prisma, PostgreSQL, Recharts, Docker Compose
- **Personas**: Scout / Analyst / Executive (Acquisition Executive and Legal excluded)
- **Pipeline**: fixed 7 stages, manual transition with append-only history, no approval workflow
- **Deal info**: INCLUDED (resolved contradiction — Q5 originally excluded it while Q7/Q8/Q16 depended on it)
- **Notifications**: in-app only, no email (local environment has no SMTP)
