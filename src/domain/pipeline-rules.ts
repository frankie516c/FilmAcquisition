/**
 * D5 — 파이프라인 단계 정의와 전환 판정.
 *
 * ⚠️ import 금지 구역.
 * 설계 근거: business-logic-model.md 6.1절
 */

export const STAGES = [
  "DISCOVERY",
  "SCREENING",
  "EVALUATION",
  "OFFER",
  "NEGOTIATION",
  "CLOSED_WON",
  "REJECTED",
] as const;

export type Stage = (typeof STAGES)[number];

export const TERMINAL_STAGES: readonly Stage[] = ["CLOSED_WON", "REJECTED"];

const STAGE_LABELS: Record<Stage, string> = {
  DISCOVERY: "발굴",
  SCREENING: "스크리닝",
  EVALUATION: "평가",
  OFFER: "오퍼",
  NEGOTIATION: "협상",
  CLOSED_WON: "계약체결",
  REJECTED: "반려",
};

export function getStageLabel(stage: Stage): string {
  return STAGE_LABELS[stage];
}

export function isTerminal(stage: Stage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/**
 * 단계 건너뛰기와 되돌리기를 모두 허용한다 (US-006).
 * 승인 워크플로가 범위 밖이므로 전이 제약을 두지 않는 것이 요구사항과 일치한다.
 *
 * from === to만 막는다 — 아무 변화 없는 이력 레코드가 쌓이는 것을 방지하기 위함이다.
 */
export function isValidTransition(from: Stage, to: Stage): boolean {
  return from !== to;
}
