# Build Instructions — Film Acquisition Dashboard

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — Build and Test

> 이 문서의 수치는 **실제 실행해 측정한 값**입니다. 추정치가 아닙니다.

---

## 1. 사전 요구사항

| 항목 | 값 | 확인 방법 |
|---|---|---|
| **Node.js** | 20 이상 (검증 환경: **24.18.0**) | `node -v` |
| **npm** | 10 이상 (검증 환경: **11.16.0**) | `npm -v` |
| **PostgreSQL** | 16 이상 (검증 환경: **17.10**) | `psql --version` |
| **디스크** | 약 700MB (`node_modules` 약 400MB + `.next` 약 60MB) | — |
| **OS** | Windows 10 / macOS / Linux (검증 환경: Windows 10 Pro 19045) | — |

**Docker는 선택 사항입니다.** `docker compose up` 경로와 로컬 PostgreSQL 경로 두 가지를 지원하며,
검증은 **Docker 없이 로컬 PostgreSQL**로 수행했습니다.

### 필수 환경변수

| 변수 | 용도 | 누락 시 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 접속 문자열 | Prisma 초기화 실패 |
| `SESSION_SECRET` | 세션 서명 키 | `verifyRequiredEnv()`가 기동을 중단 |
| `SEED_PASSWORD` | 데모 계정 공통 비밀번호 (선택, 기본 `demo1234`) | 기본값 사용 |

`.env.example`을 `.env`로 복사해 사용합니다. `.env`는 버전 관리에서 제외됩니다 (BR-U1-024).

---

## 2. 빌드 절차

### 2.1 의존성 설치

```bash
npm install
```

**npm 11 이상에서 주의**: install script가 기본 차단되어 Prisma 엔진과 esbuild 바이너리가
생성되지 않습니다. 다음 경고가 보이면 승인이 필요합니다.

```
npm warn allow-scripts N packages have install scripts not yet covered by allowScripts
```

```bash
npm approve-scripts prisma @prisma/client @prisma/engines esbuild sharp
npm rebuild
```

승인 기록은 `package.json`의 `allowScripts`에 남으므로 **최초 1회만** 필요합니다.

### 2.2 데이터베이스 준비

```sql
CREATE ROLE fad LOGIN PASSWORD 'fad_local_dev';
CREATE DATABASE fad OWNER fad ENCODING 'UTF8';
ALTER ROLE fad CREATEDB;   -- Prisma가 shadow database를 만드는 데 필요
```

> `CREATEDB`가 없으면 `prisma migrate dev`가 **P3014**로 실패합니다. 실제로 겪은 오류입니다.

### 2.3 스키마 적용과 시드

```bash
npx prisma generate          # Prisma 클라이언트 생성
npx prisma migrate dev       # 마이그레이션 생성·적용 (최초 1회)
npm run db:seed              # 시드 적재 (멱등 — 이미 있으면 건너뜀)
```

### 2.4 빌드

```bash
npm run build
```

### 2.5 실행

```bash
npm run dev                                                    # 개발
node --env-file=.env node_modules/next/dist/bin/next start     # 프로덕션
```

---

## 3. 빌드 성공 판정 기준

**실측 결과 (2026-07-26)**

| 항목 | 측정값 |
|---|---|
| 컴파일 | `✓ Compiled successfully in 2.3s` |
| 전체 빌드 (타입 검사·페이지 수집 포함) | **29.1초** |
| 생성 라우트 | **29개** (정적 3 · 동적 26) |
| 타입 오류 | **0건** |

**빌드 산출물**

| 경로 | 내용 |
|---|---|
| `.next/standalone/` | 독립 실행 서버 (`node server.js`) |
| `.next/static/` | 클라이언트 번들 (공통 청크 약 103KB) |
| `node_modules/@prisma/client/` | 생성된 Prisma 클라이언트 |

**허용되는 경고**

| 경고 | 판단 |
|---|---|
| `recharts@2.x branches are no longer active` | 무시 가능. v3 마이그레이션은 범위 밖 |
| `package.json#prisma is deprecated` | 무시 가능. Prisma 7 전환 시 `prisma.config.ts`로 이동 |
| `New major version of npm available` | 무시 가능 |

---

## 4. 문제 해결

### 4.1 `Failed to load native binding` / `ERR_DLOPEN_FAILED`

**원인**: 네이티브 바인딩이 필요한 패키지가 현재 OS·런타임과 맞지 않음.
실제로 `@node-rs/argon2`에서 발생했고, Windows에 MSVC 재배포 패키지가 없어 `.node` 로드가 실패했습니다.

**해결**: 네이티브 대신 WASM 구현을 사용합니다. 현재 코드는 `hash-wasm` 기반이라 이 문제가 없습니다.
다른 패키지에서 같은 증상이 나면 순수 JS·WASM 대안을 찾는 것이 로컬 배포에서는 더 안전합니다.

### 4.2 `P3014 — shadow database를 만들 수 없음`

**원인**: DB 롤에 `CREATEDB` 권한이 없음.
**해결**: `ALTER ROLE fad CREATEDB;` (2.2절)

### 4.3 `Environment variable not found: DATABASE_URL`

**원인**: Prisma CLI는 `.env`를 자동 로드하지만 `tsx`는 하지 않습니다.
**해결**: 이미 `package.json`의 `db:seed`가 `tsx --env-file-if-exists=.env`를 쓰도록 되어 있습니다.
직접 스크립트를 실행할 때는 같은 플래그를 붙이거나 환경변수를 미리 내보내세요.

### 4.4 Prisma 클라이언트 타입이 스키마와 어긋남

**원인**: `schema.prisma` 수정 후 `prisma generate`를 다시 돌리지 않음.
**해결**: `npx prisma generate` 후 재빌드.

### 4.5 빌드는 되는데 페이지 수집 단계에서 실패

**원인**: 모듈 최상위에서 실행되는 코드가 DB나 환경변수를 요구함.
**해결**: 빌드 시에도 `DATABASE_URL`과 `SESSION_SECRET`을 설정하세요. 값이 실제 DB를 가리키지
않아도 되지만 **존재해야** 합니다.
