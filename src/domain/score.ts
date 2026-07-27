/**
 * D6 — 평가 점수 산출.
 *
 * ⚠️ import 금지 구역.
 * 설계 근거: business-logic-model.md 6.2절
 */

export interface EvaluationScores {
  /** 작품성 1~5 */
  artistry: number;
  /** 상업성 1~5 */
  commerciality: number;
  /** 화제성 1~5 */
  buzz: number;
  /** 타깃 적합성 1~5 */
  targetFit: number;
}

export interface OverallScore {
  score: number;
  count: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 항목 4개의 평균. 소수 첫째 자리까지 반올림. */
export function calculateEvaluationScore(scores: EvaluationScores): number {
  return round1(
    (scores.artistry + scores.commerciality + scores.buzz + scores.targetFit) / 4,
  );
}

/**
 * 작품의 종합 점수.
 * 평가가 0건이면 null을 반환한다 — 0점이 아니다. 화면에서 "미평가"로 표시한다 (US-010).
 */
export function calculateOverallScore(
  allScores: readonly EvaluationScores[],
): OverallScore | null {
  if (allScores.length === 0) return null;
  const sum = allScores.reduce((acc, s) => acc + calculateEvaluationScore(s), 0);
  return { score: round1(sum / allScores.length), count: allScores.length };
}
