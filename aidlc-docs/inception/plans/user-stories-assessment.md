# User Stories Assessment

**작성일**: 2026-07-25
**단계**: 🔵 INCEPTION — User Stories (Part 1, Step 1)

---

## Request Analysis

- **Original Request**: "using AI-DLC, 나는 Film Acquisition Dashboard를 만들고 싶어" — 영화 판권 인수 파이프라인·평가·수익성·마감을 통합 관리하는 웹 대시보드 신규 구축
- **User Impact**: **Direct** — 전 기능이 사용자 대면이며, 역할에 따라 화면과 데이터 노출이 달라짐
- **Complexity Level**: **Medium** — 기능 요구사항 24건, 도메인 엔티티 10개, 역할 3개 × 권한 11항목
- **Stakeholders**: Scout(작품 발굴·평가), Analyst(딜·재무), Executive(포트폴리오 열람·사용자 관리)

---

## Assessment Criteria Met

### High Priority (ALWAYS Execute)
- [x] **New User Features** — FR-001~FR-024 전부가 신규 사용자 대면 기능
- [x] **Multi-Persona Systems** — Scout / Analyst / Executive 3개 역할이 서로 다른 목표와 권한을 가짐
- [x] **Complex Business Logic** — 파이프라인 7단계 전환 규칙, 역할별 금액 마스킹, 재무 산식, 마감 D-day 알림 규칙 등 다중 시나리오 존재
- [ ] User Experience Changes — 해당 없음 (기존 워크플로 없음, 그린필드)
- [ ] Customer-Facing APIs — 해당 없음 (외부 소비자 없음)
- [ ] Cross-Team Projects — 해당 없음 (1인 프로젝트)

### Medium Priority (Complexity-Based)
- [x] **Security Enhancements** — 인증 및 역할 기반 권한이 사용자 경험을 직접 좌우함 (Scout에게는 특정 필드가 아예 보이지 않음)
- [x] **Data Changes** — CSV 가져오기/내보내기 결과가 역할별 마스킹에 따라 달라짐

### Complexity Assessment Factors
- [x] **Scope** — 작품 관리 / 파이프라인 / 평가·협업 / 딜·판권 / 대시보드 / 입출력 / 인증 등 다수 터치포인트에 걸침
- [x] **Testing** — 성공 기준 6개가 모두 사용자 관점 수용 테스트 형태이며, 스토리 수용 기준으로 직접 전환 가능
- [x] **Options** — 마스킹 경계(가정 A-1), 재무 모델 범위(가정 A-4) 등 복수의 유효한 구현 해석이 존재
- [ ] Ambiguity — 요구사항 단계에서 모순 3건·모호성 2건을 이미 해소함
- [ ] Risk — 개인 PoC로 비즈니스 리스크는 낮음
- [ ] Stakeholders — 실제 다수 이해관계자는 없음 (개인 프로젝트)

### Skip Criteria (해당 없음)
- [ ] Pure Refactoring / Isolated Bug Fixes / Infrastructure Only / Developer Tooling / Documentation — **모두 해당하지 않음**

---

## Expected Benefits

1. **역할별 동작 차이를 명시적으로 고정** — 동일 화면이 Scout·Analyst·Executive에게 어떻게 다르게 보이는지를 스토리 단위로 분리해, 마스킹 누락 같은 구현 오류를 사전에 차단
2. **수용 기준의 테스트 전환** — NFR-007의 PBT 적용 대상(재무 계산, D-day 계산, CSV 왕복)이 어떤 스토리에 속하는지 연결되어 테스트 설계가 명확해짐
3. **Units Generation의 입력 제공** — 스토리 그룹이 이후 작업 단위(unit) 분해의 기준선이 됨
4. **범위 고정** — 제외 항목 12건이 "스토리가 없는 영역"으로 가시화되어 구현 중 범위 확장을 방지

---

## Decision

**Execute User Stories**: **Yes**

**Reasoning**:
High Priority 지표 3개(New User Features, Multi-Persona Systems, Complex Business Logic)에 모두 해당하므로 규칙상 무조건 실행 대상이다. 특히 이 프로젝트의 핵심 난점은 기능 자체보다 **동일 기능이 역할에 따라 다르게 동작한다는 점**(권한 매트릭스 11행 × 3역할)에 있으며, 이는 기능 요구사항 목록만으로는 구현 시 누락되기 쉽다. 페르소나별 스토리로 분해하면 이 차이가 명시적 수용 기준으로 고정된다.

1인 프로젝트라 "팀 정렬" 편익은 크지 않으나, 스토리가 Units Generation과 Code Generation의 직접 입력이 되고 요구사항의 성공 기준 6개가 그대로 수용 테스트로 전환되므로 오버헤드 대비 편익이 충분하다.

---

## Expected Outcomes

- `stories.md` — INVEST 기준을 충족하는 사용자 스토리 (각 스토리에 수용 기준 및 FR 추적성 포함)
- `personas.md` — Scout / Analyst / Executive 3개 페르소나의 목표·불만점·행동 패턴·권한 경계
- 스토리 ↔ 요구사항(FR/NFR) ↔ 성공 기준 간 추적 가능한 연결
- 이후 Units Generation 단계에서 작업 단위 분해의 기준선
