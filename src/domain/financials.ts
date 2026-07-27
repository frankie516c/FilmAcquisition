/**
 * D1 — 재무 계산. 이 프로젝트에서 재무 산식이 존재하는 유일한 곳이다.
 *
 * NFR-008: 화면·대시보드·리포트·내보내기가 모두 이 함수를 호출한다.
 * 산식의 사본을 다른 곳에 만드는 것은 설계 위반이다 (판정 기준 #4).
 *
 * ⚠️ import 금지 구역.
 * 설계 근거: business-logic-model.md 2절
 */

/** KRW 정수(원 단위). 4바이트 정수로는 P&A 예산·예상 매출에서 오버플로가 난다. */
export type Money = bigint;

export interface FinancialInput {
  /** MG가 있으면 MG, 없으면 오퍼 금액. 선택 규칙은 selectAcquisitionBase 참조 */
  offerAmount: Money;
  /** P&A(마케팅) 예산 */
  paAndBudget: Money;
  otherCosts: Money;
  expectedRevenue: Money;
}

export interface FinancialResult {
  totalAcquisitionCost: Money;
  expectedProfit: Money;
  /** 총 인수비용이 0이면 null (= 화면에서 N/A). 예외를 던지지 않는다. */
  roiPercent: number | null;
  breakEvenRevenue: Money;
}

/**
 * 인수비용의 기준액을 고른다.
 * MG(최소보증금)는 지급이 확정된 금액이므로 있다면 그것이 인수비용이다.
 * 오퍼 금액은 아직 협상 중인 제시액이다.
 */
export function selectAcquisitionBase(
  minimumGuarantee: Money | null | undefined,
  offerAmount: Money | null | undefined,
): Money {
  if (minimumGuarantee !== null && minimumGuarantee !== undefined) return minimumGuarantee;
  if (offerAmount !== null && offerAmount !== undefined) return offerAmount;
  return 0n;
}

export function calculateFinancials(input: FinancialInput): FinancialResult {
  const totalAcquisitionCost =
    input.offerAmount + input.paAndBudget + input.otherCosts;
  const expectedProfit = input.expectedRevenue - totalAcquisitionCost;

  return {
    totalAcquisitionCost,
    expectedProfit,
    roiPercent: calculateRoi(expectedProfit, totalAcquisitionCost),
    breakEvenRevenue: totalAcquisitionCost,
  };
}

/**
 * ROI(%)는 백분율이므로 number로 반환한다.
 * 다만 bigint를 number로 먼저 변환하면 큰 값에서 정밀도가 손실되므로,
 * 정수 연산을 최대한 유지한 뒤 마지막에만 변환한다.
 *
 * 소수 둘째 자리까지 버림 처리한다. 반올림하지 않는 이유:
 * bigint 나눗셈이 이미 버림이므로 규칙이 일관되고, 버림은 항상 보수적이라
 * 수익성을 과대평가하지 않는다.
 */
function calculateRoi(expectedProfit: Money, totalCost: Money): number | null {
  if (totalCost === 0n) return null; // 0으로 나누지 않는다 (US-016)
  const scaled = (expectedProfit * 10_000n) / totalCost;
  return Number(scaled) / 100;
}
