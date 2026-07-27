/**
 * D1 재무 계산 — 속성 기반 테스트 5개.
 *
 * 이 시점(U1)에는 이 함수를 호출하는 화면이 아직 없다. 그래도 여기서 통과해야 한다.
 * 순수 함수는 화면 없이 검증 가능하며, 계산의 정확성을 UI 작업 전에 확정해 두면
 * 나중에 값이 이상할 때 원인이 계산이 아니라 데이터 경로임을 즉시 알 수 있다.
 *
 * 설계 근거: business-logic-model.md 2.5절
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateFinancials } from "@/domain/financials";

/** 0 ~ 1000조. 실무 최대치를 크게 넘는 범위까지 검증한다. */
const money = fc.bigInt({ min: 0n, max: 10n ** 15n });
const RUNS = { numRuns: 100, seed: 20260725 };

describe("D1 FinancialCalculator", () => {
  it("P1 — 손익분기 매출은 항상 총 인수비용과 같다", () => {
    fc.assert(
      fc.property(money, money, money, money, (offer, pa, other, revenue) => {
        const r = calculateFinancials({
          offerAmount: offer,
          paAndBudget: pa,
          otherCosts: other,
          expectedRevenue: revenue,
        });
        expect(r.breakEvenRevenue).toBe(r.totalAcquisitionCost);
      }),
      RUNS,
    );
  });

  it("P2 — 매출이 총 인수비용과 같으면 손익은 0이고 ROI는 0%", () => {
    fc.assert(
      fc.property(money, money, money, (offer, pa, other) => {
        const total = offer + pa + other;
        const r = calculateFinancials({
          offerAmount: offer,
          paAndBudget: pa,
          otherCosts: other,
          expectedRevenue: total,
        });
        expect(r.expectedProfit).toBe(0n);
        if (total === 0n) expect(r.roiPercent).toBeNull();
        else expect(r.roiPercent).toBe(0);
      }),
      RUNS,
    );
  });

  it("P3 — 예상 매출이 증가하면 손익과 ROI는 감소하지 않는다 (단조성)", () => {
    fc.assert(
      fc.property(money, money, money, money, money, (offer, pa, other, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const base = { offerAmount: offer, paAndBudget: pa, otherCosts: other };
        const low = calculateFinancials({ ...base, expectedRevenue: lo });
        const high = calculateFinancials({ ...base, expectedRevenue: hi });

        expect(high.expectedProfit >= low.expectedProfit).toBe(true);
        if (low.roiPercent !== null && high.roiPercent !== null) {
          expect(high.roiPercent).toBeGreaterThanOrEqual(low.roiPercent);
        }
      }),
      RUNS,
    );
  });

  it("P4 — 총 인수비용이 0이면 ROI는 null이고 예외를 던지지 않는다", () => {
    fc.assert(
      fc.property(money, (revenue) => {
        const r = calculateFinancials({
          offerAmount: 0n,
          paAndBudget: 0n,
          otherCosts: 0n,
          expectedRevenue: revenue,
        });
        expect(r.roiPercent).toBeNull();
        expect(r.breakEvenRevenue).toBe(0n);
      }),
      RUNS,
    );
  });

  it("P5 — 모든 결과 금액이 정수(bigint)로 유지된다", () => {
    fc.assert(
      fc.property(money, money, money, money, (offer, pa, other, revenue) => {
        const r = calculateFinancials({
          offerAmount: offer,
          paAndBudget: pa,
          otherCosts: other,
          expectedRevenue: revenue,
        });
        expect(typeof r.totalAcquisitionCost).toBe("bigint");
        expect(typeof r.expectedProfit).toBe("bigint");
        expect(typeof r.breakEvenRevenue).toBe("bigint");
      }),
      RUNS,
    );
  });
});
