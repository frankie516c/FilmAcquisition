# Frontend Components — U4 Deal & Financials

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U4 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 컴포넌트 계층

```
app/(app)/titles/[id]/
├── page.tsx           서버 · 마스킹 판정 + 조립
├── deal-form.tsx      클라이언트 · 딜 + 재무 입력 (Analyst만 렌더)
└── rights-section.tsx 클라이언트 · 판권 표시 + 입력
```

**마스킹 판정은 전부 서버에서** 이뤄집니다. 클라이언트 컴포넌트는 이미 걸러진 값만 받습니다.

---

## 2. 딜 카드 (서버 렌더, `page.tsx` 안)

### 2.1 필드별 조건부 렌더링

```tsx
{canReadField(role, "Deal", "minimumGuarantee")
  ? <div className="field"><span>MG</span><span>{formatKrw(deal.minimumGuarantee)}</span></div>
  : <Masked label="MG (최소보증금)" />}
```

**`Masked` 컴포넌트**
```tsx
<div className="field">
  <span className="fk">{label}</span>
  <span className="masked"><em>•••</em> 권한 없음</span>
</div>
```

**값을 숨기는 게 아니라 자리를 남깁니다.** 필드가 사라지면 "MG가 없는 작품"으로 오해합니다.

### 2.2 헤더 라벨이 상태를 알린다

```
딜 정보                          [전체 공개]   ← Analyst·Executive
딜 정보                          [부분 마스킹]  ← Scout
```

카드를 열자마자 지금 보고 있는 것이 전부인지 아닌지 알 수 있습니다.

### 2.3 오퍼 만료 배지

`offerExpiryDate` 옆에 D-day 배지를 붙입니다.

| 조건 | 색 |
|---|---|
| `dDay < 0` | 위험 — `N일 경과` |
| `dDay <= 7` | 경고 — `D-3` |
| 그 외 | 중립 — `D-45` |

---

## 3. 재무 카드 (서버 렌더)

**세 가지 상태**

| 상태 | 표시 |
|---|---|
| 권한 있음 + 데이터 있음 | 총 인수비용·예상 매출·예상 손익·손익분기·ROI |
| 권한 있음 + 데이터 없음 | *"등록된 재무 정보가 없습니다."* |
| **권한 없음** | 회색 안내 상자 — 엔티티 단위 차단의 이유까지 설명 |

**색으로 부호를 알립니다**: 예상 손익과 ROI가 음수면 `--crit`, 양수면 `--good`.
액센트가 아닌 의미색을 쓰는 이유는 "강조"가 아니라 "손실"이기 때문입니다.

**ROI가 `null`이면 `N/A`** — `0%`가 아닙니다. 계산 불가와 수익 0을 구분합니다.

---

## 4. `deal-form.tsx` — 딜·재무 입력

**렌더 조건**: `canPerform(role, "deal:update")` — Analyst만

**props**

| props | 내용 |
|---|---|
| `titleId` | 대상 작품 |
| `deal: DealFormValues` | 7개 필드의 **문자열** 초기값 |
| `financials: FinancialFormValues` | 3개 필드의 문자열 초기값 |

**전부 문자열인 이유**: `bigint`는 서버 컴포넌트에서 클라이언트 컴포넌트로 직렬화되지
않습니다. `.toString()`으로 넘기고 서버가 다시 `BigInt`로 파싱합니다.

**상태**: `open`(접힘/펼침), `d`(딜 입력), `f`(재무 입력), `issues`, `message`, `pending`

### 4.1 단일 요청으로 저장 (2026-07-26 개정)

```
제출 → PUT /api/titles/{id}/deal-financials
        { deal: {...}, financials: {...} | undefined }
   실패 → issues 표시 (딜·재무 어느 쪽도 저장되지 않음)
   성공 → 폼 접기 + router.refresh()
```

**초기 구현은 두 API를 순차 호출했고, 딜만 저장되고 재무가 실패하는 중간 상태가 가능했습니다.**
사용자는 "저장 실패"를 보지만 딜은 이미 바뀌어 있어 무엇이 반영됐는지 알 수 없었습니다.

통합 엔드포인트로 묶어 해소했습니다. 검증이 트랜잭션보다 먼저 일어나므로 **어느 한쪽이
검증에 걸리면 양쪽 모두 저장되지 않습니다.**

`tests/integration/deal-atomicity.test.ts`가 이를 검증합니다 — 유효한 딜과 음수 재무를 함께
보낸 뒤, 400을 받고 **딜이 이전 값 그대로인지** 확인합니다.

### 4.2 오류 경로 매칭

중첩 스키마라 서버가 주는 경로가 `deal.minimumGuarantee` 형태입니다. 폼은 필드명만 알므로
마지막 마디로 매칭합니다.

```ts
const issueFor = (field: string) =>
  issues.find((i) => i.path === field || i.path.endsWith(`.${field}`))?.message;
```

### 4.3 기본 접힘

`open=false`가 기본입니다. 상세 화면의 주 목적은 조회이고 편집은 부수적입니다.
`딜·재무 편집` 버튼을 눌러야 폼이 펼쳐집니다.

### 4.4 입력 보조

- 금액 입력란에 `placeholder`로 예시 자릿수를 보여줍니다 (`900000000`)
- 날짜는 `<input type="date">` — 형식 오류를 브라우저가 먼저 걸러냅니다
- 폼 하단 안내: *"총 인수비용·손익·ROI는 저장하지 않습니다. 조회 시점에 단일 산식으로
  계산됩니다."* — 저장 안 되는 필드를 찾아 헤매지 않게 합니다

---

## 5. `rights-section.tsx` — 판권

**props**: `titleId`, `rights: RightsRow[]`, `canEdit: boolean`

**목록 표시** (전 역할)
```
대한민국 · 일본        2026-01-01 ~ 2028-01-01   [D-524]
아시아                2025-06-01 ~ 2028-06-01   [D-676]
```

만료 D-day 배지 기준은 딜과 다릅니다 — 판권은 `dDay <= 30`이 경고입니다(알림 임계값 `[30, 7]`과 일치).

**입력 폼** (`canEdit`일 때만)
- 영토 14종을 토글 알약으로 다중 선택
- 시작일·종료일은 `<input type="date">`
- 하단 안내: *"종료일은 시작일보다 **이후**여야 합니다. 같은 날짜는 거부됩니다 — 기간이 0일인
  판권은 의미가 없기 때문입니다."*

**판권이 2건 이상이면 표시하는 안내**:
*"영토나 기간이 겹쳐도 저장됩니다. 권리 충돌 검증은 이번 범위에 포함되지 않습니다."*

> 사용자가 시스템이 충돌을 잡아주리라 기대하는 것이 가장 위험합니다. 겹치는 판권이 실제로
> 생겼을 때 알려줍니다.

**API**: `POST /api/titles/{id}/rights`

---

## 6. 화면 ↔ API 매핑 (U4)

| 화면 | API |
|---|---|
| 딜·재무 카드 표시 | (서버 직접 조회 + `canReadField` 판정) |
| **딜·재무 저장 (폼)** | **`PUT /api/titles/{id}/deal-financials`** — 단일 트랜잭션 |
| 딜만 부분 수정 | `PUT /api/titles/{id}/deal` |
| 재무만 부분 수정 | `PUT /api/titles/{id}/financials` |
| 재무 조회 (미사용) | `GET /api/titles/{id}/financials` |
| 판권 등록 | `POST /api/titles/{id}/rights` |

`GET /api/titles/{id}/financials`는 현재 화면에서 쓰이지 않습니다 — 상세 페이지가 서버에서
직접 계산합니다. 외부 소비나 향후 클라이언트 갱신을 위해 남겨두었습니다.

---

## 7. 마스킹을 눈으로 확인하는 방법

역할을 바꿔가며 같은 작품 상세를 열면 이 유닛의 설계가 그대로 드러납니다.

| 역할 | 딜 카드 | 재무 카드 |
|---|---|---|
| Scout | 오퍼 금액·유효기간만, 나머지 `••• 권한 없음` | 회색 안내 상자 |
| Analyst | 전 필드 + 편집 버튼 | 계산 결과 5줄 |
| Executive | 전 필드, 편집 버튼 없음 | 계산 결과 5줄 |

**화면에서 가린 것이 아니라 데이터가 오지 않는다**는 점은 브라우저 개발자 도구의 네트워크
탭에서 확인할 수 있습니다.
