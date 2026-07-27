# Film Acquisition Dashboard

영화 판권 인수 파이프라인·평가·수익성·마감을 통합 관리하는 웹 대시보드입니다.
[AI-DLC](https://github.com/awslabs/aidlc-workflows) 워크플로로 요구사항부터 설계까지 진행한 뒤 구현했습니다.

**개인 학습·포트폴리오 목적의 로컬 실행 프로토타입입니다.** 실제 인수 업무에 사용하려면
보안(SECURITY)·복원력(Resiliency) 확장을 활성화한 재설계와 법무 검토를 거친 계약·판권 모델
재정의가 선행되어야 합니다.

---

## 지금 바로 보기 — 인터랙티브 프로토타입

설치 없이 브라우저에서 동작을 확인할 수 있습니다:
**https://claude.ai/code/artifact/19b85acd-e264-4dac-8490-119297a302ba**

- 상단에서 **역할을 전환**하고 작품 상세로 들어가면, API 응답 페이로드에서 MG·재무 필드가
  **키째로 사라지는 것**을 직접 볼 수 있습니다
- 칸반에서 카드를 옮기면 이력이 추가되고, **체류 일수 총합 = 등록 후 경과 일수**가 유지됩니다
- 사용자 관리에서 Executive를 1명까지 줄이면 `409 LAST_EXECUTIVE`가 발동합니다

---

## 실행

### 필요 조건
Docker Desktop (또는 Docker Engine + Compose). 로컬 개발 시 Node.js 20 이상.

### Docker로 실행 (권장)

```bash
cp .env.example .env
# .env의 SESSION_SECRET을 실제 난수로 교체:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up
```

`http://localhost:3000` 에서 접속합니다. 최초 기동 시 마이그레이션과 시드가 자동 적용됩니다.
재기동해도 시드는 중복 적재되지 않습니다.

### 로컬 개발 (Docker 없이 — 검증된 경로)

PostgreSQL이 로컬에 설치되어 있다면 DB와 롤을 먼저 만듭니다. `.env`의 `DATABASE_URL`과
값이 일치해야 합니다.

```sql
CREATE ROLE fad LOGIN PASSWORD 'fad_local_dev';
CREATE DATABASE fad OWNER fad ENCODING 'UTF8';
ALTER ROLE fad CREATEDB;   -- Prisma가 shadow database를 만드는 데 필요
```

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

`npm install` 시 npm 11의 보안 정책으로 install script가 차단되면
`npm approve-scripts prisma @prisma/client @prisma/engines esbuild sharp` 후 `npm rebuild` 하세요.
승인 기록은 `package.json`의 `allowScripts`에 남습니다.

### 데모 계정

| 이메일 | 역할 | 볼 수 있는 것 |
|---|---|---|
| `scout1@fad.local` | Scout | 오퍼 금액까지. **MG·러닝로열티·계약조건·재무는 응답에 오지 않음** |
| `analyst@fad.local` | Analyst | 전 항목. 딜·판권·재무 편집 가능 |
| `exec1@fad.local` | Executive | 전 항목 조회 전용 + 사용자 관리 |

비밀번호는 `.env`의 `SEED_PASSWORD` (기본값 `demo1234`)입니다.
⚠️ 공개된 값이므로 로컬 PoC 전용입니다.

---

## 테스트

```bash
npm test                 # 단위 + 속성 기반 (29개) — DB 불필요
npm run test:property    # 속성 기반만
npm run test:integration # 통합 (23개) — 서버와 DB가 떠 있어야 함
```

**통합 테스트는 기본 실행에서 분리되어 있습니다.** 서버·DB가 필요하므로 섞으면 환경이 없는
곳에서 전부 실패해, 정작 순수 로직의 회귀 신호까지 묻힙니다.
대상 주소는 `FAD_BASE_URL`로 바꿀 수 있습니다 (`BASE_URL`은 Vite가 선점하므로 쓸 수 없습니다).

**속성 기반 테스트 17개**가 순수 함수 4종을 검증합니다. 속성당 100회 실행, 고정 시드로
실패를 재현할 수 있습니다.

| 모듈 | 검증하는 성질 |
|---|---|
| `financials` | 손익분기 = 총 인수비용 · 매출 증가 시 ROI 단조 비감소 · 0 나누기 시 `null` · 결과 정수 보존 |
| `dwell-time` | **체류 일수 총합 = 등록 후 경과 일수** · 구간 비중첩 · 모든 일수 ≥ 0 |
| `deadline` | 같은 날이면 D-0 · 하루당 정확히 1 증가 · 시각 무관 · 음수면 항상 expired |
| `csv` | **왕복 무손실** (한글·쉼표·따옴표·줄바꿈 포함) · 손상 입력에도 예외 없음 |

---

## 설계에서 중요한 결정 네 가지

### 1. 권한 정책의 기본값은 "차단"

`src/platform/authz/policy.ts` 의 필드 정책 표에 등재되지 않은 필드는 **모든 역할에게 차단**됩니다.

새 필드를 추가하고 정책 등록을 잊었을 때, 기본값이 "허용"이면 민감 정보가 조용히 노출됩니다.
기본값이 "차단"이면 "보여야 할 게 안 보인다"는 눈에 띄는 버그로 나타납니다.
**실패가 안전한 방향으로 일어나게 만든 것**입니다.

마스킹은 화면 숨김이 아니라 **응답 객체에서 키를 제거**합니다. `null` 대입이 아닙니다.
HTTP JSON·CSV·PDF·Excel 네 경로가 모두 같은 게이트(`serialize.ts`)를 통과합니다.

### 2. 이력 수정은 타입 시스템이 막는다

`StageTransition`을 다루는 리포지토리에 `update`·`delete` 메서드를 **정의하지 않습니다.**
런타임 검사가 아니라 컴파일 단계에서 차단되며, 스키마에도 `updatedAt`을 두지 않아
수정을 전제하지 않는 테이블임이 드러납니다.

이것이 "체류 일수 총합 = 등록 후 경과 일수" 속성이 성립하는 전제입니다.

### 3. 금액은 8바이트 정수

PostgreSQL의 4바이트 정수는 **약 21억**이 상한입니다. MG는 그 안에 들어와도
P&A 예산과 예상 매출은 쉽게 넘어갑니다 — 시드의 예상 매출 300억 원이 그 사례입니다.

JavaScript `BigInt`는 JSON으로 직접 직렬화되지 않지만, 어차피 모든 응답이 직렬화 게이트를
통과하므로 **변환 지점이 한 곳뿐**입니다.

### 4. 재무 산식은 한 곳에만 있다

ROI·손익분기는 `src/domain/financials.ts` 에서만 계산됩니다. 화면·대시보드·리포트·내보내기가
모두 이 함수를 호출합니다. 산식의 사본을 만드는 것은 설계 위반입니다.

---

## 구조

```
src/
  domain/       순수 함수 — 아무것도 import 하지 않는 구역. 현재 시각도 인자로 받는다
  platform/     횡단 관심사 — 권한정책 · 직렬화게이트 · 오류매핑 · 검증 · 컨텍스트 · 영속성
  modules/      기능별 모듈 — 서비스 · 리포지토리 · 스키마 · UI
  app/api/      REST Route Handlers (API 경계)
prisma/         스키마 · 마이그레이션 · 시드
tests/          속성 기반 · 단위 · 통합
aidlc-docs/     AI-DLC 설계 문서 (요구사항 → 스토리 → 설계 → 유닛 분해)
```

**설계 위반 판정 기준** (코드 리뷰 시 확인):
1. `src/domain/**` 에 외부 `import` 존재
2. 리포지토리 밖에서 `@prisma/client` import
3. 직렬화 게이트를 거치지 않은 응답
4. 재무 산식이 `domain/financials.ts` 밖에 존재
5. `StageTransition` 수정·삭제 시도
6. 서비스 메서드가 `role`을 인자로 받음 (역할은 `ctx`에서만)
7. 허용되지 않은 모듈 간 직접 import

---

## 구현 현황

| 유닛 | 범위 | 상태 |
|---|---|---|
| **U1 Foundation & Auth** | 플랫폼 6종 · 순수 도메인 6종 · 인증·권한 · 전체 스키마 · 시드 · PBT 17속성 · 로그인·사용자관리 | ✅ 완료 |
| **U2 Title & Evaluation** | 작품 등록(T3)·수정·삭제(T2)·검색·상세, 평가 등록, 코멘트 + 멘션 알림(T4) | ✅ 완료 |
| **U3 Pipeline** | 칸반 보드, 단계 전환(T1), 이력·체류 일수 | ✅ 완료 |
| **U4 Deal & Financials** | 딜·판권·재무 입력과 조회, 역할별 마스킹, ROI 계산 | ✅ 완료 |
| **U5 Dashboard & Reports** | 위젯 3종, CSV 내보내기·가져오기(T5), 알림 센터 + 마감 스캔(T7), 리포트 3종 | ✅ 완료 |

**동작하는 화면**

| 경로 | 내용 |
|---|---|
| `/login` | 로그인. 데모 계정 버튼으로 이메일 자동 입력 |
| `/dashboard` | 위젯 3종. 단계 클릭 시 필터된 목록으로 이동, 집계 기준·기간 전환 |
| `/board` | 칸반 7열. 드래그로 단계 변경 → 이력 기록. Executive는 드래그 비활성 |
| `/titles` | 작품 목록 + 등록 · CSV 가져오기 · CSV 내보내기 (전부 권한별 노출) |
| `/titles/new` | 작품 등록. 원제+연도가 겹치면 **차단이 아니라 경고**하고 그대로 등록 가능 |
| `/titles/import` | CSV 가져오기. **미리보기에서 오류 행을 확인한 뒤** 전체/정상행만 선택 반영 |
| `/titles/[id]` | 상세. 딜 마스킹·재무 차단·체류 일수 검증이 한 화면에. Scout는 작품 수정·삭제와 평가, Analyst는 딜·재무·판권 편집, 전 역할 코멘트 |
| `/reports` | 리포트 3종. 인쇄용 보기(→PDF) 또는 Excel용 CSV |
| 헤더 🔔 | 알림 센터. 미확인 배지, 전체 읽음, 마감 스캔(중복 방지 확인용) |
| `/users` | 사용자 관리. Executive 1명이 되면 409 `LAST_EXECUTIVE` |

### 설계와 다른 점 (기록)

**US-025는 PDF를 서버에서 생성하도록 요구했으나, 인쇄용 화면 + 브라우저 인쇄로 대체했습니다.**
서버 생성은 한글 TTF를 저장소에 함께 넣어야 하는데(수 MB) 로컬 프로토타입에서 비용 대비 이득이
없다고 판단했습니다. 브라우저가 시스템 폰트를 쓰므로 "한글이 깨지지 않아야 한다"는 수용 기준은
만족하지만 **생성 주체가 서버가 아니라 클라이언트**입니다. Excel은 BOM 포함 UTF-8 CSV로 제공합니다.
`/reports` 화면에도 같은 내용을 적어 두었습니다.

**범위 밖(설계 확정)**: 판권 충돌 검증, 이메일 발송, 외부 데이터 연동, 다통화·다국어, 클라우드 배포.
**의도적 대체**: 서버 PDF 생성 → 인쇄 화면, 알림 스케줄러 → 수동 스캔 트리거.

### 직접 확인해볼 것

1. **역할별 마스킹** — 같은 작품 상세를 Scout / Analyst로 각각 열어보세요. Scout에게는 MG·계약조건이 `••• 권한 없음`이고 재무 카드는 통째로 차단됩니다. 화면에서 가린 게 아니라 응답에 필드가 없습니다.
2. **내보내기도 같은 규칙** — 목록에서 CSV를 받으면 Scout 파일은 9컬럼, Analyst 파일은 17컬럼입니다. 버튼이 제외된 컬럼 이름을 알려줍니다.
3. **멘션 알림** — 코멘트에 `@이분석` 을 넣으면 그 계정 알림 센터에만 생깁니다. 작성자 본인에게는 생기지 않습니다.
4. **중복 방지** — 알림 센터의 "마감 스캔"을 여러 번 눌러보세요. 두 번째부터는 `생성 0건 · 중복으로 건너뜀 N건` 입니다.
5. **마지막 경영진 보호** — `/users` 에서 Executive를 1명까지 줄이면 남은 1명의 버튼이 잠기고, API를 직접 호출하면 409 `LAST_EXECUTIVE` 입니다.

---

## 설계 문서

| 문서 | 내용 |
|---|---|
| [requirements.md](aidlc-docs/inception/requirements/requirements.md) | 기능 요구사항 24건 · 비기능 9건 · 권한 매트릭스 |
| [stories.md](aidlc-docs/inception/user-stories/stories.md) | 사용자 스토리 32개 (Given-When-Then 수용 기준) |
| [personas.md](aidlc-docs/inception/user-stories/personas.md) | 페르소나 3종과 권한 경계 |
| [application-design.md](aidlc-docs/inception/application-design/application-design.md) | 컴포넌트 20개 · 서비스 17개 · 의존 관계 |
| [unit-of-work.md](aidlc-docs/inception/application-design/unit-of-work.md) | 유닛 분해와 코드 조직 전략 |
| [business-logic-model.md](aidlc-docs/construction/u1-foundation-auth/functional-design/business-logic-model.md) | 알고리즘 상세와 PBT 속성 근거 |
