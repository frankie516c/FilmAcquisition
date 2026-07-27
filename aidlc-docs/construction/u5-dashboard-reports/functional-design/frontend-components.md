# Frontend Components — U5 Dashboard & Reports

**작성일**: 2026-07-26
**단계**: 🟢 CONSTRUCTION — U5 Functional Design

> ⚠️ **as-built 기록입니다.**

---

## 1. 컴포넌트 계층

```
app/(app)/
├── dashboard/page.tsx           서버 · 위젯 3종 (상호작용은 링크로)
├── notification-bell.tsx        클라이언트 · 알림 센터 (U1 레이아웃에 배치)
├── titles/
│   ├── export-button.tsx        클라이언트 · CSV 내보내기
│   └── import/
│       ├── page.tsx             서버 · 권한 게이트
│       └── import-panel.tsx     클라이언트 · 미리보기 → 반영
└── reports/
    ├── page.tsx                 서버 · 리포트 3종 목록
    └── [kind]/
        ├── page.tsx             서버 · 인쇄용 렌더
        └── print-button.tsx     클라이언트 · window.print()
```

---

## 2. `dashboard/page.tsx` — 위젯 3종

**타입**: 서버 컴포넌트. **클라이언트 상태가 없습니다.**

**상호작용을 전부 링크로 처리합니다.**

| 조작 | 방식 |
|---|---|
| 단계 클릭 → 필터 목록 | `<Link href={{pathname:"/titles", query:{stage}}}>` |
| 집계 기준 전환 | `<Link href={{pathname:"/dashboard", query:{basis, range}}}>` |
| 기간 전환 (7/30/90) | 〃 |

**`useState` 대신 URL을 쓰는 이유**: 대시보드 상태가 공유 가능해집니다. "이 화면 좀 봐 주세요"
라고 URL을 보낼 수 있고, 새로고침해도 유지됩니다. 서버 컴포넌트로 남길 수 있어 JS 번들도
줄어듭니다.

**입력**: `searchParams` (`basis`, `range`) — 유효하지 않은 값은 기본값으로 대체합니다.

### 2.1 파이프라인 현황

```
발굴      ████████░░  5    900,000,000원   ← 행 전체가 링크
스크리닝  ██████░░░░  4    오퍼 없음
...
─────────────────────────────────
병목 구간            평가 · 평균 32일 체류
```

막대 폭은 `count / maxCount × 100%`입니다.

### 2.2 포트폴리오 구성

장르 6종 막대 + 국가 알약 + 라인업 갭 경고 상자.
헤더에 `계약체결`/`전체` 전환 알약(현재 선택이 액센트색).

### 2.3 마감 임박

```
일곱 개의 문        [D-1]     ← 경고색
 오퍼 만료 · 2026-07-27
깊은 물             [5일 경과] ← 위험색
 오퍼 만료 · 2026-07-21
```

헤더에 7/30/90일 전환 알약.

---

## 3. `notification-bell.tsx` — 알림 센터

**위치**: `(app)/layout.tsx`의 상단바 (전 화면 공통)

**props**: `initialUnread: number` — 서버에서 미리 조회한 값

**상태**: `open`, `items`, `unread`, `scanMsg`

**동작**
```
드롭다운 열림 → GET /api/notifications (그때 조회)
[전체 읽음]  → POST /api/notifications → 배지 0
[마감 스캔]  → POST /api/notifications/scan → "생성 N건 · 중복으로 건너뜀 M건"
알림 클릭    → 해당 작품 상세로 이동
```

**`initialUnread`를 서버에서 받는 이유**: 배지가 첫 페인트에 바로 보여야 합니다.
클라이언트에서 조회하면 숫자가 나중에 튀어나옵니다.

**스캔 결과를 그대로 보여주는 이유**: `생성 0건 · 중복으로 건너뜀 1건`이 표시되면 중복 방지가
동작한다는 것을 사용자가 직접 확인합니다. 버튼을 여러 번 눌러도 알림이 늘지 않는 것이
그 자체로 검증 수단입니다.

**유형별 아이콘**: 💬 멘션 · ⏳ 오퍼 만료 · 📄 판권 만료

---

## 4. `export-button.tsx` — CSV 내보내기

**props**: `stage?: string` (현재 필터)

**동작**
```
fetch(`/api/export/titles?stage=...`)
  실패 → 상태코드·코드·메시지 표시
  성공 → Blob → <a download> 클릭 → URL.revokeObjectURL
         X-Omitted-Columns 헤더를 읽어 안내
```

**결과 메시지**
```
권한 제한 있음: "24행 내보냈습니다. 권한이 없어 제외된 컬럼: 요청가, MG, …"
제한 없음:     "24행 내보냈습니다. 전 컬럼 포함."
```

**`<a href download>` 대신 `fetch` + Blob을 쓰는 이유**: 응답 헤더(`X-Omitted-Columns`)를
읽어야 합니다. 단순 링크로는 헤더에 접근할 수 없습니다.

**권한이 없으면 버튼 대신 `내보내기 권한 없음` 배지**를 보여줍니다.

---

## 5. `titles/import/` — CSV 가져오기

### 5.1 `page.tsx` (서버)

`canPerform(role, "import:commit")` 판정. 없으면 안내 화면.

### 5.2 `import-panel.tsx` (클라이언트)

**상태**: `file`, `preview`, `message`, `pending`

**3단계 흐름**
```
1. [템플릿 다운로드]  →  GET /api/import/titles
2. 파일 선택 → [미리보기] → POST (mode 없음)
                              ↓
   전체 N행 · 정상 M행 · 오류 K건
   ┌─────┬────────┬──────────────────────────┐
   │ 행  │ 컬럼   │ 사유                     │
   │ 4   │titleKo │ 제목을(를) 입력해주세요. │
   └─────┴────────┴──────────────────────────┘
   반영될 작품 (최대 5건 미리보기)
                              ↓
3. [정상 M행만 반영]  또는  [전체 반영]
```

**`전체 반영` 버튼은 오류가 있으면 `disabled`** 이고 `title` 속성으로 이유를 알립니다 —
*"오류 행이 있어 전체 반영할 수 없습니다."*

**`FormData`로 전송합니다.** `mode`를 같은 폼에 담아 미리보기와 반영이 같은 엔드포인트를 씁니다.

**미리보기 단계임을 명시**: *"미리보기 단계에서는 아무것도 저장되지 않습니다."*

**장르 구분자 안내**: *"장르는 `드라마;스릴러` 처럼 세미콜론으로 구분합니다."*

---

## 6. `reports/` — 리포트

### 6.1 `reports/page.tsx` — 목록

리포트 3종을 카드로 나열하고 각각 두 가지 출구를 둡니다.

```
파이프라인 현황 요약
[인쇄용 보기 → PDF]  [Excel용 CSV]
```

`인쇄용 보기`는 `target="_blank"` — 인쇄 후 원래 화면으로 돌아오기 쉽습니다.

**설계와 다른 점을 화면에 적었습니다.** 별도 카드로:
> *"요구사항(US-025)은 PDF를 서버에서 생성하도록 했습니다. … 인쇄용 화면 + 브라우저 인쇄로
> 대체했습니다. … 생성 주체가 서버가 아니라 클라이언트라는 점이 원래 설계와 다릅니다."*

문서에만 적고 화면에는 감추면, 이 시스템을 넘겨받는 사람이 요구사항과 구현의 차이를
발견하지 못합니다.

### 6.2 `reports/[kind]/page.tsx` — 인쇄용

**인쇄 CSS**
```css
@media print {
  .rail, .top, .no-print { display: none !important; }
  .page { padding: 0 !important; }
  .shell { display: block !important; }
  body { background: #fff; }
  tr { page-break-inside: avoid; }   /* 행이 페이지 경계에서 잘리지 않게 */
}
```

**머리말** (US-025)
```
파이프라인 현황 요약
생성 시각 2026-07-26 17:43 · 생성자 최경영
```

**섹션 렌더링**: `sections`를 순회하며 `heading` + 표를 그립니다. 행이 없으면
*"해당 항목이 없습니다."* 를 표시합니다.

### 6.3 `print-button.tsx`

`window.print()` 한 줄. 클라이언트 컴포넌트여야 하는 유일한 이유입니다.

옆에 안내: *"인쇄 대화상자에서 대상을 'PDF로 저장'으로 선택하세요."*

---

## 7. 화면 ↔ API 매핑 (U5)

| 화면 | API |
|---|---|
| `/dashboard` | (서버 직접 집계) |
| 알림 벨 | `GET·POST /api/notifications`, `POST /api/notifications/scan` |
| CSV 내보내기 | `GET /api/export/titles` |
| CSV 가져오기 | `GET·POST /api/import/titles` |
| `/reports` | (정적) |
| `/reports/[kind]` | (서버 직접 조회) |
| Excel용 CSV | `GET /api/reports/[kind]` |
