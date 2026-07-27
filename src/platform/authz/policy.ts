/**
 * X1 — 권한 정책. "누가 무엇을 할 수 있고 어떤 필드를 볼 수 있는가"의 선언적 단일 지점.
 *
 * 핵심 규칙: 정책에 등재되지 않은 필드의 기본값은 "차단"이다.
 * 새 필드를 추가하고 정책 등록을 잊으면, 민감 정보가 조용히 노출되는 대신
 * "보여야 할 게 안 보인다"는 눈에 띄는 버그로 나타난다.
 * 실패가 안전한 방향으로 일어나게 한다 (BR-U1-012).
 *
 * 설계 근거: business-rules.md 3절, components.md X1
 */

export type Role = "SCOUT" | "ANALYST" | "EXECUTIVE";

export const ROLE_LABELS: Record<Role, string> = {
  SCOUT: "스카우트",
  ANALYST: "분석가",
  EXECUTIVE: "경영진",
};

// ─────────────────────────────────────────────────────────
// 동작 권한 (action-level) — 권한 매트릭스 12항목
// ─────────────────────────────────────────────────────────

export type Action =
  | "title:write"
  | "festival:write"
  | "evaluation:write"
  | "comment:create"
  | "pipeline:changeStage"
  | "deal:update"
  | "rights:write"
  | "financial:update"
  | "import:commit"
  | "export:execute"
  | "report:generate"
  | "user:manage";

const ACTION_POLICY: Record<Action, readonly Role[]> = {
  "title:write": ["SCOUT"],
  "festival:write": ["SCOUT"],
  "evaluation:write": ["SCOUT"],
  "comment:create": ["SCOUT", "ANALYST", "EXECUTIVE"],
  "pipeline:changeStage": ["SCOUT", "ANALYST"],
  "deal:update": ["ANALYST"],
  "rights:write": ["ANALYST"],
  "financial:update": ["ANALYST"],
  "import:commit": ["SCOUT", "ANALYST"],
  "export:execute": ["SCOUT", "ANALYST"],
  "report:generate": ["ANALYST", "EXECUTIVE"],
  "user:manage": ["EXECUTIVE"],
};

export function canPerform(role: Role, action: Action): boolean {
  return ACTION_POLICY[action].includes(role);
}

// ─────────────────────────────────────────────────────────
// 필드 권한 (field-level)
// ─────────────────────────────────────────────────────────

const ALL_ROLES: readonly Role[] = ["SCOUT", "ANALYST", "EXECUTIVE"];
const NO_ROLE: readonly Role[] = [];

type EntityPolicy =
  /** 엔티티 전체가 특정 역할에게만 열린다. 차단 시 관계 필드째로 제거된다. */
  | { kind: "entity"; roles: readonly Role[] }
  /** 전 필드 공개 */
  | { kind: "open" }
  /** 필드별 정책. 미등재 필드는 차단. */
  | { kind: "fields"; fields: Record<string, readonly Role[]> };

const FIELD_POLICY: Record<string, EntityPolicy> = {
  Title: { kind: "open" },
  FestivalRecord: { kind: "open" },
  Evaluation: { kind: "open" },
  Comment: { kind: "open" },
  StageTransition: { kind: "open" },
  RightsGrant: { kind: "open" },
  Notification: { kind: "open" },

  // 세션 ID가 응답에 실리면 탈취 위험이 생긴다. 세션은 쿠키로만 전달된다.
  Session: { kind: "entity", roles: NO_ROLE },

  User: {
    kind: "fields",
    fields: {
      id: ALL_ROLES,
      email: ALL_ROLES,
      name: ALL_ROLES,
      role: ALL_ROLES,
      createdAt: ALL_ROLES,
      updatedAt: ALL_ROLES,
      // passwordHash는 등재하지 않는다 → 기본값 차단
    },
  },

  Deal: {
    kind: "fields",
    fields: {
      id: ALL_ROLES,
      titleId: ALL_ROLES,
      createdAt: ALL_ROLES,
      updatedAt: ALL_ROLES,
      // 파이프라인 위젯이 단계별 오퍼 금액 합계를 표시하고 Scout도 이 위젯을 본다.
      // 만료 임박도 담당 작품 관리에 필요하다.
      offerAmount: ALL_ROLES,
      offerSubmittedAt: ALL_ROLES,
      offerExpiryDate: ALL_ROLES,
      // 평가 독립성을 위해 Scout에게 차단한다 (requirements.md 가정 A-1)
      askingPrice: ["ANALYST", "EXECUTIVE"],
      minimumGuarantee: ["ANALYST", "EXECUTIVE"],
      runningRoyaltyRate: ["ANALYST", "EXECUTIVE"],
      contractTerms: ["ANALYST", "EXECUTIVE"],
    },
  },

  // 엔티티 단위 차단. 필드를 하나씩 지우면 빈 객체가 남아
  // "재무 데이터가 있긴 하다"는 정보가 새어 나간다.
  FinancialModel: { kind: "entity", roles: ["ANALYST", "EXECUTIVE"] },
};

export function canReadEntity(role: Role, entity: string): boolean {
  const policy = FIELD_POLICY[entity];
  if (policy === undefined) return false; // 미등재 엔티티 → 차단
  if (policy.kind === "entity") return policy.roles.includes(role);
  return true;
}

export function canReadField(role: Role, entity: string, field: string): boolean {
  const policy = FIELD_POLICY[entity];
  if (policy === undefined) return false; // 미등재 엔티티 → 차단
  if (policy.kind === "open") return true;
  if (policy.kind === "entity") return policy.roles.includes(role);
  const allowed = policy.fields[field];
  if (allowed === undefined) return false; // 미등재 필드 → 차단
  return allowed.includes(role);
}

export function getReadableFields(role: Role, entity: string): readonly string[] {
  const policy = FIELD_POLICY[entity];
  if (policy === undefined) return [];
  if (policy.kind === "entity") return policy.roles.includes(role) ? ["*"] : [];
  if (policy.kind === "open") return ["*"];
  return Object.keys(policy.fields).filter((f) => canReadField(role, entity, f));
}

/**
 * 중첩 객체가 어느 엔티티인지 알려주는 지도.
 * 여기 없는 관계 필드는 직렬화 게이트가 차단한다 — 새 관계를 추가하고
 * 등록을 잊으면 하위 객체 전체가 미검증 상태로 노출되기 때문이다.
 */
export const RELATION_MAP: Record<string, Record<string, string>> = {
  Title: {
    deal: "Deal",
    financialModel: "FinancialModel",
    rightsGrants: "RightsGrant",
    evaluations: "Evaluation",
    comments: "Comment",
    festivalRecords: "FestivalRecord",
    stageTransitions: "StageTransition",
    assignee: "User",
  },
  Evaluation: { evaluator: "User" },
  Comment: { author: "User" },
  StageTransition: { changedBy: "User" },
  Notification: { title: "Title", comment: "Comment" },
};
