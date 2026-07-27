# Business Logic Model — U4 Deal & Financials

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U4 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 구성 요소

| 파일 | 역할 |
|---|---|
| `modules/deals/service.ts` | 딜·판권·재무 쓰기와 재무 조회 |
| `domain/financials.ts` | D1 — 재무 산식 (순수, PBT 5속성). **유일한 정의 지점** |
| `platform/authz/policy.ts` | X1 — 필드·엔티티 정책 |
| `platform/authz/serialize.ts` | X2 — 마스킹 실행 |
| `titles/[id]/deal-form.tsx` · `rights-section.tsx` | 입력 화면 |

---

## 2. 딜 저장

```
PUT /api/titles/{id}/deal
 1. requireContext()
 2. validate(dealSchema, body)          금액 비음수·날짜 순서 → 400 + fields[]
 3. saveDeal(ctx, titleId, input)
      a. requireRole(ctx, ANALYST)      Scout·Executive → 403
      b. Title 존재 확인 → 404
      c. prisma.deal.upsert({ where:{titleId}, create:{titleId,...}, update:{...} })
 4. serialize(role, "Deal", deal)       ← 저장 직후에도 게이트를 통과시킨다
 5. 200
```

**저장 응답도 마스킹을 거칩니다.** Analyst만 저장할 수 있으니 실질적 차이는 없지만,
"모든 응답은 게이트를 통과한다"는 규칙에 예외를 두지 않습니다. 예외가 하나 생기면 다음 예외의
근거가 됩니다.

---

## 3. 판권 등록

```
POST /api/titles/{id}/rights
 1. validate(rightsGrantSchema, body)   영토 최소 1개, 종료일 > 시작일
 2. saveRights(ctx, titleId, input)
      a. requireRole(ctx, ANALYST)
      b. Title 존재 확인 → 404
      c. prisma.rightsGrant.create(...)  ← upsert가 아니다. 1:N이므로 계속 쌓인다
         ※ 기존 판권과의 영토·기간 겹침을 검사하지 않는다 (범위 밖)
 3. 201
```

**충돌 검사를 하지 않는다는 것을 코드 주석에 명시**했습니다. 빠뜨린 것이 아니라 범위 밖이라는
사실이 코드를 읽는 사람에게 보여야 합니다.

---

## 4. 재무 저장과 조회

### 4.0 딜·재무 통합 저장 (2026-07-26 추가) — 화면이 쓰는 경로

```
PUT /api/titles/{id}/deal-financials   { deal: {...}, financials?: {...} }
 1. validate(dealWithFinancialsSchema)      ★ 트랜잭션보다 먼저
      어느 한쪽이라도 실패 → 400, 아무것도 저장되지 않음
 2. saveDealAndFinancials(ctx, titleId, input)
      a. requireRole(ctx, ANALYST)
      b. Title 존재 확인 → 404
      c. runInTransaction:
           deal = tx.deal.upsert(...)
           financials 있으면 → tx.financialModel.upsert(...) 후
                                toView(model, deal)   ← 방금 저장한 딜 기준
 3. { deal, financials } 각각 직렬화 → 200
```

**왜 묶었는가**: 초기 구현은 화면이 `/deal`과 `/financials`를 순차 호출했고, 딜만 저장되고
재무가 실패하는 중간 상태가 가능했습니다. 사용자는 "저장 실패"를 보지만 딜은 이미 바뀌어
있어 무엇이 반영됐는지 알 수 없었습니다.

**계산 기준 시점이 중요합니다.** 재무 계산에 **같은 트랜잭션에서 방금 저장한 딜**을 씁니다.
이전 딜로 계산하면 MG를 바꾼 즉시의 응답이 옛 값 기준이 되어 화면과 어긋납니다.
통합 테스트가 이를 확인합니다 — MG를 8억에서 10억으로 바꾸며 재무를 함께 보내고,
총 인수비용이 24억이 아니라 **26억**인지 검사합니다.

**개별 엔드포인트는 남아 있습니다.** `/deal`과 `/financials`는 부분 수정용이며, 한쪽만
바꿀 때는 애초에 중간 상태가 성립하지 않습니다.

### 4.1 저장 (개별)

```
PUT /api/titles/{id}/financials
 1. validate(financialInputSchema)      3개 금액 전부 비음수 정수
 2. saveFinancialInput(ctx, titleId, input)
      a. requireRole(ctx, ANALYST)
      b. Title + Deal 함께 조회          ← 계산에 딜의 MG·오퍼 금액이 필요
      c. FinancialModel upsert (입력값 3개만 저장)
      d. toView(saved, title.deal)       ← 저장 직후 계산해서 반환
 3. serialize(role, "FinancialModel", view)
 4. 200
```

**저장 응답에 계산 결과를 함께 담습니다.** 저장 후 다시 조회하는 왕복을 없앱니다.

### 4.2 조회

```
GET /api/titles/{id}/financials
 1. getFinancials(ctx, titleId)
      a. requireRole(ctx, ANALYST, EXECUTIVE)   Scout → 403
      b. Title + Deal + FinancialModel 조회
      c. financialModel 없으면 null 반환         404가 아니다
      d. toView(model, deal)
 2. 200 { financials: … | null }
```

**재무 정보가 없을 때 404가 아니라 `null`인 이유**: 작품은 존재하고 재무만 아직 입력되지
않은 것입니다. 404는 "작품이 없다"와 구분되지 않습니다.

### 4.3 `toView` — 계산 조립

```
toView(model, deal):
  기준액 = selectAcquisitionBase(deal?.minimumGuarantee, deal?.offerAmount)
  결과   = calculateFinancials({ offerAmount: 기준액, ...model })
  반환   = { ...결과, ...model }        입력값과 계산값을 함께
```

입력값을 함께 반환하는 이유: 화면이 "예상 매출 38억"과 "예상 손익 14억"을 같이 보여줘야
사용자가 계산을 따라갈 수 있습니다.

---

## 5. D1 — 재무 산식 (순수 함수, PBT 5속성)

### 5.1 산식

| 항목 | 계산 |
|---|---|
| 총 인수비용 | `기준액 + P&A + 기타` |
| 예상 손익 | `예상 매출 − 총 인수비용` (음수 가능) |
| 손익분기 매출 | `총 인수비용` |
| ROI(%) | `(손익 ÷ 총비용) × 100`, 총비용 0이면 `null` |

### 5.2 ROI의 정밀도 처리

```
1. totalCost === 0n  →  null 반환 (예외 아님)
2. scaled = (expectedProfit × 10000n) / totalCost     ← bigint 나눗셈, 소수 이하 버림
3. roiPercent = Number(scaled) / 100                  ← 소수 둘째 자리까지 보존
```

**`bigint`를 먼저 `number`로 바꾸면 안 되는 이유**: 금액이 `Number.MAX_SAFE_INTEGER`(약 9,007조)에
가까우면 변환 시 정밀도가 손실됩니다. 정수 연산을 최대한 유지하고 마지막에만 변환합니다.

`scaled`의 크기는 `10000 × (손익/비용)` 규모라 실무 범위에서 안전 정수 한계를 넘지 않습니다.

### 5.3 PBT 속성

| # | 속성 | 이 속성이 잡는 것 |
|---|---|---|
| P1 | 손익분기 = 총 인수비용 | 두 값이 갈라지는 변경 |
| P2 | 매출=비용이면 손익 0·ROI 0% | 부호나 순서 실수 |
| P3 | 매출 증가 시 손익·ROI 비감소 | 단조성 위반 (부호 뒤집힘) |
| P4 | 비용 0이면 ROI `null`, 예외 없음 | 0 나누기 |
| P5 | 결과 금액이 `bigint` 유지 | 중간에 `number` 변환이 끼어드는 것 |

입력 범위 `0n ~ 10^15n`(1000조) — 실무 최대치를 크게 넘는 범위까지 검증합니다.

---

## 6. 마스킹 실행 경로

### 6.1 필드별 (Deal)

```
serialize(role, "Deal", deal):
  각 (key, value)에 대해
    canReadField(role, "Deal", key) === false  →  결과 객체에 넣지 않음
    true  →  변환 후 포함 (bigint → 문자열, Date → ISO)
```

### 6.2 엔티티 단위 (FinancialModel)

```
serialize(role, "Title", title):
  key === "financialModel" 이고 RELATION_MAP에 등록됨
    canReadEntity(role, "FinancialModel") === false  →  관계 필드째 건너뜀
```

Scout의 응답에는 `financialModel` 키가 **아예 없습니다**. 빈 객체도 남지 않습니다.

### 6.3 화면에서의 판정

화면은 `serialize` 결과를 쓰지 않고 `canReadField`/`canReadEntity`를 **직접 호출**해
마스킹 라벨을 그릴지 값을 그릴지 정합니다.

> 두 경로가 같은 정책 함수를 보므로 어긋나지 않습니다. 화면이 자체 판단을 하면 서버와
> 어긋납니다.

---

## 7. 데이터 흐름 (상세 화면)

```
titles/[id]/page.tsx (서버)
  findTitleDetail(id)                      Prisma — 마스킹 이전 원본
    ├─ deal      → serialize(role,"Deal")  마스킹 적용본 (표시용)
    ├─ title.deal (원본)                    canReadField가 true인 필드만 직접 읽음
    └─ financialModel
         canReadEntity(role) === true  →  calculateFinancials(...)
         false                         →  null → 안내 문구 카드
```

**원본과 마스킹본을 둘 다 들고 있습니다.** 서버 컴포넌트 안에서는 원본 접근이 가능하므로
`canReadField`로 게이트를 열어 값을 꺼냅니다. 이 판정을 빠뜨리면 마스킹이 무력화되므로
필드마다 조건을 답니다.

> 클라이언트 컴포넌트(`DealForm`)에는 **Analyst일 때만** 원본 값을 내려보냅니다.
> `canPerform(role, "deal:update")`가 false면 컴포넌트 자체를 렌더하지 않습니다.
