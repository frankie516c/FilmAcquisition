# Security Test Instructions — Film Acquisition Dashboard

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — Build and Test

---

## 1. 이 문서의 범위 — 먼저 읽을 것

**SECURITY 확장은 이 프로젝트에서 비활성입니다** (Q18 = B). 따라서 이 문서는 확장 규칙에 따른
정식 보안 검증이 아니라, **NFR-005가 정한 최소 조치가 실제로 지켜지는지** 확인하는 절차입니다.

> ⚠️ **여기의 항목을 전부 통과해도 프로덕션 보안 요건을 충족하지 않습니다.**
> 감사 로그, 레이트 리미팅, 비밀번호 정책, 세션 고정 방어, 취약점 스캔, 침투 테스트는
> 모두 범위 밖입니다. 실제 인수 업무에 쓰려면 SECURITY 확장을 켜고 재설계해야 합니다
> (requirements.md 2.3절).

---

## 2. NFR-005 최소 조치 검증

### 2.1 비밀번호 평문 저장 없음

```sql
select email, left("passwordHash", 20) as hash_prefix from "User" limit 3;
```

**기대**: 모든 값이 `$argon2id$v=19$...` 로 시작. 평문이나 단순 해시가 아님.
**실측**: argon2id 형식 확인 ✅

### 2.2 `passwordHash`가 응답에 포함되지 않음

```bash
curl -b cookies.txt http://localhost:3100/api/users | grep -c passwordHash
```

**기대**: `0`
**실측**: Executive로 `/api/users` 조회 시 `passwordHash` 미포함 ✅ (필드 정책에서 전 역할 차단)

### 2.3 로그인 실패 시 계정 존재 여부 미노출

```bash
# 존재하는 계정 + 틀린 비밀번호
curl -X POST .../api/auth/login -d '{"email":"scout1@fad.local","password":"wrong"}'
# 존재하지 않는 계정
curl -X POST .../api/auth/login -d '{"email":"nobody@fad.local","password":"demo1234"}'
```

**기대**: 두 응답의 상태코드와 메시지가 **완전히 동일**
**실측**: 둘 다 `401 {"error":{"code":"AUTHENTICATION_FAILED","message":"이메일 또는 비밀번호가 올바르지 않습니다."}}` ✅

**타이밍 차이도 확인하세요.** 계정이 없을 때도 더미 해시로 argon2 검증을 수행하도록 되어 있습니다
(BR-U1-002). 응답 시간이 눈에 띄게 다르면 이 경로가 깨진 것입니다.

```powershell
# 각 20회씩 재서 평균을 비교한다. 유의미한 차이가 없어야 한다.
```

### 2.4 권한 우회 불가 (서버 측 강제)

**핵심 검증**: UI를 조작해도 서버가 막는가.

```bash
# Scout 세션으로 Analyst 전용 API 직접 호출
curl -b scout-cookies.txt -X PUT .../api/titles/{id}/deal -d '{"offerAmount":"1"}'
```

**기대**: `403 FORBIDDEN`, 데이터 변화 없음
**실측**: 쓰기 API 8종 전부 권한 매트릭스대로 403 반환 ✅
(integration-test-instructions.md S10 참조)

### 2.5 마스킹 필드가 응답 페이로드에 없음

```bash
curl -b scout-cookies.txt .../api/titles/{id}/financials
```

**기대**: `403` (서비스 진입에서 차단) — 또는 Deal 조회 시 `minimumGuarantee` **키 자체가 부재**
**실측**: 재무는 403, 딜 응답에서 MG·러닝로열티·계약조건 키 부재 ✅

> `null`이 아니라 **키가 없어야** 합니다. `"minimumGuarantee": null` 이 나오면 실패입니다.

### 2.6 SQL 인젝션 방지

**방식**: Prisma ORM의 파라미터 바인딩만 사용하며 raw SQL이 없습니다.

```bash
# 코드에 raw 쿼리가 없는지 확인
grep -rn "queryRaw\|executeRaw\|\$queryRawUnsafe" src/
```

**기대**: 결과 없음
**검증 방법**: 검색 필터에 `'; DROP TABLE "Title"; --` 를 넣어도 단순 문자열로 처리됨

### 2.7 비밀 정보 하드코딩 없음

```bash
grep -rn "postgresql://\|SESSION_SECRET\s*=\s*[\"']" src/ prisma/ --include=*.ts
```

**기대**: `process.env` 참조만 발견. 실제 값은 없음
**확인**: `.gitignore`에 `.env`가 포함되어 있고 `.env.example`에는 자리표시자만 있음 ✅

### 2.8 500 오류의 내부 정보 미노출

**절차**: 의도적으로 DB를 내린 뒤 API를 호출합니다.
**기대**: `{"error":{"code":"INTERNAL_ERROR","message":"요청을 처리하지 못했습니다."}}`
스택 트레이스·SQL·파일 경로가 응답에 없어야 합니다 (BR-U1-017).

### 2.9 세션 쿠키 속성

```bash
curl -i -X POST .../api/auth/login -d '{...}' | grep -i set-cookie
```

**기대**: `HttpOnly`, `SameSite=Lax`, `Path=/`, **`Max-Age`·`Expires` 없음**(브라우저 종료 시 소멸)
**`Secure`는 접속 프로토콜에 따릅니다** — http면 붙지 않고 https면 붙습니다.

> ⚠️ 이 지점에서 실제 결함이 있었습니다. `secure`를 `NODE_ENV === "production"`으로 판정하면
> `next start`가 항상 production이므로 `http://localhost`에서 쿠키가 되돌아오지 않아
> **로그인이 200을 받고도 세션이 유지되지 않습니다.** 현재는 요청 프로토콜로 판정합니다.

---

## 3. 의존성 취약점 점검

```bash
npm audit
npm audit --production   # 런타임 의존성만
```

**판단 기준**: SECURITY 확장이 꺼져 있으므로 **차단 기준은 없습니다.** 다만 `high`·`critical`이
런타임 의존성에서 발견되면 기록해 두고, 프로덕션 전환 시 반드시 해소해야 합니다.

---

## 4. 검증하지 않은 것 (범위 밖)

| 항목 | 사유 |
|---|---|
| 침투 테스트 | SECURITY 확장 비활성 |
| 레이트 리미팅 / 무차별 대입 방어 | 미구현. 로그인 시도 횟수 제한이 없습니다 |
| 감사 로그 | 미구현. 누가 무엇을 언제 바꿨는지는 `StageTransition`에만 남습니다 |
| 비밀번호 정책 | 8자 이상만 강제. 복잡도·재사용 금지·만료 없음 |
| CSRF 방어 | `SameSite=Lax`에 의존. 별도 토큰 없음 |
| 세션 고정 방어 | 로그인 시 세션 ID 재발급을 하지만 명시적 검증은 안 함 |
| 파일 업로드 검증 | CSV 크기 제한·악성 콘텐츠 검사 없음 |
| 전송 구간 암호화 | 로컬 http 전제. TLS 미적용 |

**이 목록이 곧 프로덕션 전환 시 해야 할 일의 시작점입니다.**
