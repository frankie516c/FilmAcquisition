/**
 * D3 D-day — 속성 기반 테스트 4개.
 * 설계 근거: business-logic-model.md 4.4절
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateDDay, classifyDeadline, type DeadlineRange } from "@/domain/deadline";

const RUNS = { numRuns: 100, seed: 20260725 };
const DAY = 86_400_000;
const BASE = Date.UTC(2024, 0, 1);

/** 하루 안의 임의 시각 (KST 기준 같은 날에 머무는 범위) */
const msInDay = fc.integer({ min: 0, max: 86_399_999 });
const dayOffset = fc.integer({ min: -500, max: 500 });
const ranges = fc.constantFrom<DeadlineRange>(7, 30, 90);

/** KST 달력일 d에 속하는 임의 시각을 만든다 */
const instantOn = (d: number, ms: number) => new Date(BASE + d * DAY - 9 * 3_600_000 + ms);

describe("D3 DeadlineCalculator", () => {
  it("P1 — 같은 날이면 시각이 달라도 D-day는 0이다", () => {
    fc.assert(
      fc.property(dayOffset, msInDay, msInDay, (d, msA, msB) => {
        expect(calculateDDay(instantOn(d, msA), instantOn(d, msB))).toBe(0);
      }),
      RUNS,
    );
  });

  it("P2 — 만료일을 하루 늘리면 D-day가 정확히 1 증가한다 (선형성)", () => {
    fc.assert(
      fc.property(dayOffset, dayOffset, msInDay, msInDay, (base, target, msA, msB) => {
        const a = calculateDDay(instantOn(base, msA), instantOn(target, msB));
        const b = calculateDDay(instantOn(base, msA), instantOn(target + 1, msB));
        expect(b - a).toBe(1);
      }),
      RUNS,
    );
  });

  it("P3 — 시각(시·분·초)만 바뀌어도 결과가 동일하다", () => {
    fc.assert(
      fc.property(dayOffset, dayOffset, msInDay, msInDay, msInDay, msInDay,
        (base, target, m1, m2, m3, m4) => {
          const a = calculateDDay(instantOn(base, m1), instantOn(target, m2));
          const b = calculateDDay(instantOn(base, m3), instantOn(target, m4));
          expect(a).toBe(b);
        },
      ),
      RUNS,
    );
  });

  it("P4 — D-day가 음수면 조회 범위와 무관하게 항상 expired다", () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: -1 }), ranges, (dDay, range) => {
        expect(classifyDeadline(dDay, range)).toBe("expired");
      }),
      RUNS,
    );
  });
});
