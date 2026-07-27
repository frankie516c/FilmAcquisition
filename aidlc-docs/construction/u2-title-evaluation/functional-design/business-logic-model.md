# Business Logic Model — U2 Title & Evaluation

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U2 Functional Design

> ⚠️ **as-built 기록입니다.** 구현된 흐름을 정리한 것이며 구현 전 설계서가 아닙니다.

---

## 1. 구성 요소

| 파일 | 역할 |
|---|---|
| `modules/titles/service.ts` | 작품 생성·수정·삭제, 중복 후보 조회 |
| `modules/titles/repository.ts` | 작품 조회 (목록·상세·집계용) |
| `modules/evaluation/service.ts` | 평가 등록, 코멘트 + 멘션, 코멘트 삭제 |
| `domain/score.ts` | D6 — 점수 계산 (순수 함수) |
| `domain/pipeline-rules.ts` | D5 — 초기 단계 상수 참조 |

---

## 2. 작품 생성 (T3)

```
POST /api/titles
 1. requireContext()                          미인증 → 401
 2. validate(titleCreateSchema, body)         실패 → 400 + fields[]
 3. createTitle(ctx, input)
      a. requireRole(ctx, SCOUT)              불일치 → 403
      b. runInTransaction:
           Title 생성 (stage=DISCOVERY, assigneeId ?? ctx.userId, createdAt=ctx.now)
           StageTransition 생성 (fromStage=null, toStage=DISCOVERY, note="작품 등록")
 4. serialize(role, "Title", title)           직렬화 게이트
 5. 201
```

**`createdAt`을 `ctx.now`로 명시 지정하는 이유**: DB 기본값(`now()`)에 맡기면 작품 생성 시각과
이력 `occurredAt`이 미세하게 어긋납니다. 그러면 첫 구간의 체류 일수가 0이 아닌 값이 되어
"총합 = 경과 일수" 속성이 경계 조건에서 깨질 수 있습니다. 한 요청 안에서 같은 시각을 씁니다.

---

## 3. 중복 후보 감지

```
GET /api/titles?titleOriginal=...&productionYear=...
 1. titleOriginal이 없거나 연도가 정수가 아니면 → { candidates: [] } (오류 아님)
 2. findDuplicateCandidates: 원제 + 연도 완전 일치, 최대 5건
 3. 200
```

**화면 연동**: 원제 입력란과 연도 입력란의 `onBlur`에서 호출합니다. 타이핑 중마다 호출하지
않습니다 — 입력이 끝나기 전의 부분 문자열로는 의미 있는 후보가 나오지 않습니다.

**결과가 있어도 등록 버튼을 막지 않습니다.** 경고 상자와 기존 작품 링크만 보여줍니다.

---

## 4. 작품 수정

```
PATCH /api/titles/{id}
 1. validate(titleCreateSchema.partial(), body)
 2. updateTitle(ctx, id, input)
      a. requireRole(ctx, SCOUT)
      b. 존재 확인 → 없으면 404
      c. 전달된 필드만 갱신 (undefined는 건드리지 않음)
         ※ stage는 애초에 스키마에 없어 갱신 대상이 될 수 없다
 3. 200
```

**부분 갱신 방식**: 각 필드를 `input.x !== undefined ? { x: input.x } : {}` 로 조건부 전개합니다.
`null`과 `undefined`를 구분하기 위함입니다 — `null`은 "값을 지우라", `undefined`는 "건드리지 마라"입니다.

---

## 5. 작품 삭제 (T2)

```
DELETE /api/titles/{id}
 1. deleteTitle(ctx, id)
      a. requireRole(ctx, SCOUT)
      b. runInTransaction:
           존재 확인 → 없으면 404
           Title 삭제 → 하위 엔티티는 스키마 Cascade로 함께 삭제
 2. 200
```

**애플리케이션에서 하위 엔티티를 하나씩 지우지 않습니다.** DB의 참조 무결성에 맡깁니다.
직접 지우면 순서를 틀리거나 새 관계를 추가했을 때 빠뜨립니다.

---

## 6. 평가 등록

```
POST /api/titles/{id}/evaluations
 1. validate(evaluationSchema, body)          점수 1~5 정수 검사
 2. createEvaluation(ctx, titleId, input)
      a. requireRole(ctx, SCOUT)
      b. 작품 존재 확인 → 없으면 404
      c. Evaluation 생성 (evaluatorId = ctx.userId)
         ※ upsert가 아니라 create — 기존 평가를 덮어쓰지 않는다
 3. 201
```

### 6.1 점수 계산 (D6, 순수 함수)

```
개별 평가 점수 = (작품성 + 상업성 + 화제성 + 타깃적합성) / 4,  소수 첫째 자리 반올림
종합 점수     = 개별 평가 점수들의 평균,                       소수 첫째 자리 반올림
평가 0건      = null  (미평가)
```

**항목 평균의 평균이 아니라 개별 평가 점수의 평균입니다.** 항목 수가 4로 고정이라 두 방식의
결과가 같지만, 항목이 늘어나면 달라지므로 정의를 명확히 해 둡니다.

---

## 7. 코멘트 + 멘션 (T4)

```
POST /api/titles/{id}/comments
 1. validate: trim 후 1~5000자
 2. createComment(ctx, titleId, body)
      a. requireRole(ctx, SCOUT, ANALYST, EXECUTIVE)
      b. 작품 존재 확인 → 없으면 404
      c. extractMentionNames(body)              @토큰 추출, 중복 제거
      d. User 조회 (name IN names)              존재하지 않는 이름은 자연히 빠짐
      e. runInTransaction:
           Comment 생성
           멘션 대상마다 Notification 생성 (작성자 본인은 건너뜀)
 3. 201 { comment, notified: n }
```

**`notified` 를 응답에 담는 이유**: 화면이 *"등록했습니다. 멘션 알림 2건이 생성되었습니다."*
라고 알려줄 수 있습니다. 사용자가 알림이 갔는지 추측하지 않게 합니다.

### 7.1 멘션 추출

```
정규식: /@([^\s@.,!?;:()[\]{}'"]+)/g
```

| 입력 | 추출 |
|---|---|
| `@이분석 확인 부탁` | `이분석` |
| `@이분석, @최경영도` | `이분석`, `최경영` |
| `@이분석 @이분석` | `이분석` (중복 제거) |
| `a@b.com 참고` | `b` — **오탐** |

**마지막 항목은 알려진 한계입니다.** 이메일 주소가 코멘트에 들어가면 도메인 일부가 이름으로
추출됩니다. 다만 그 이름의 사용자가 실제로 존재해야 알림이 생기므로 대부분 무해합니다.
개선하려면 사용자 목록과 대조한 뒤 최장 일치를 취하는 방식이 낫습니다.

---

## 8. 코멘트 삭제

```
DELETE (화면 미구현, 서비스만 존재)
 1. 코멘트 조회 → 없으면 404
 2. authorId !== ctx.userId → 403 "본인이 작성한 코멘트만 삭제할 수 있습니다."
 3. 삭제 (멘션 알림은 Cascade로 함께 삭제)
```

---

## 9. 목록 조회

```
listTitles(filter)
  where: stage 일치 + (titleKo OR titleOriginal) 부분 일치(대소문자 무시)
  include: assignee(id·name·role), evaluations(전체), deal(전체)
  order: createdAt 내림차순
```

**`evaluations`를 전부 가져오는 이유**: 종합 점수를 계산하려면 개별 점수가 필요합니다.
DB에서 평균을 구하면 D6의 반올림 규칙과 어긋날 수 있어 애플리케이션에서 계산합니다.

**`deal`을 함께 가져오는 이유**: 목록에 오퍼 금액을 표시하고, 칸반의 단계별 금액 합계도
같은 조회를 씁니다.

> ⚠️ **규모 주의**: 작품 500건이면 평가·딜을 전부 로딩합니다. 24건에서는 p95 173ms지만
> 규모에 따라 나빠질 수 있습니다 (performance-test-instructions.md 3절).

---

## 10. 화면 렌더링 경로의 특이점

목록·상세 화면은 **서버 컴포넌트가 리포지토리를 직접 호출**합니다. 딜 정보만 `serialize()`를
통과시키고 나머지는 Prisma 결과를 그대로 씁니다.

**이 구조가 결함을 감췄던 적이 있습니다.** 직렬화 게이트가 `genres` 배열을 제거하고 있었는데,
화면은 Prisma 결과를 직접 읽어 정상 표시됐습니다. API를 호출해야만 드러났습니다.

**교훈**: 화면이 멀쩡하다고 API가 멀쩡한 것이 아닙니다. 두 경로를 따로 검증해야 합니다.
