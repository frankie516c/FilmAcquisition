/**
 * D2 체류 일수 — 속성 기반 테스트 4개.
 *
 * P2가 이 프로젝트에서 가장 중요한 속성이다. 구간 경계를 공유하는 dayIndex 차분의
 * 합이 망원 급수로 상쇄되기 때문에 성립한다. "시각 차이 ÷ 24시간 후 내림" 방식이면
 * 구간마다 버려지는 나머지가 쌓여 이 속성이 깨진다.
 *
 * 설계 근거: business-logic-model.md 1.2절, 3.4절
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { dayIndex } from "@/domain/calendar";
import { calculateDwellSegments, type TransitionRecord } from "@/domain/dwell-time";
import { STAGES, type Stage } from "@/domain/pipeline-rules";

const RUNS = { numRuns: 100, seed: 20260725 };
const DAY = 86_400_000;
const BASE = Date.UTC(2024, 0, 1);

/** 생성 시각과, 그 이후로 흩어진 전환 0~20건 */
const scenario = fc
  .tuple(
    fc.integer({ min: 0, max: 400 }), // createdAt 오프셋(일)
    fc.array(
      fc.tuple(
        fc.integer({ min: 0, max: 900 }), // 전환 오프셋(일)
        fc.integer({ min: 0, max: 86_399_999 }), // 같은 날 안의 시각 — 결과에 영향을 주면 안 된다
        fc.integer({ min: 0, max: STAGES.length - 1 }),
      ),
      { minLength: 0, maxLength: 20 },
    ),
    fc.integer({ min: 900, max: 1200 }), // now 오프셋(일)
  )
  .map(([createdOffset, raw, nowOffset]) => {
    const createdAt = new Date(BASE + createdOffset * DAY);
    const now = new Date(BASE + nowOffset * DAY + 3_600_000);
    const transitions: TransitionRecord[] = raw
      .map(([offset, msInDay, stageIdx]) => ({
        fromStage: null as Stage | null,
        toStage: STAGES[stageIdx]!,
        occurredAt: new Date(BASE + (createdOffset + offset) * DAY + msInDay),
      }))
      .filter((t) => t.occurredAt.getTime() <= now.getTime())
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return { createdAt, transitions, now };
  });

describe("D2 DwellTimeCalculator", () => {
  it("P1 — 모든 구간의 체류 일수가 0 이상이다", () => {
    fc.assert(
      fc.property(scenario, ({ createdAt, transitions, now }) => {
        const segments = calculateDwellSegments(createdAt, transitions, now);
        for (const s of segments) expect(s.days).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it("P2 — 체류 일수의 총합이 등록 후 경과 일수와 정확히 일치한다", () => {
    fc.assert(
      fc.property(scenario, ({ createdAt, transitions, now }) => {
        const segments = calculateDwellSegments(createdAt, transitions, now);
        const sum = segments.reduce((acc, s) => acc + s.days, 0);
        expect(sum).toBe(dayIndex(now) - dayIndex(createdAt));
      }),
      RUNS,
    );
  });

  it("P3 — 구간이 시간순으로 연속하며 겹치지 않는다", () => {
    fc.assert(
      fc.property(scenario, ({ createdAt, transitions, now }) => {
        const segments = calculateDwellSegments(createdAt, transitions, now);
        for (let i = 0; i < segments.length - 1; i++) {
          expect(segments[i]!.exitedAt?.getTime()).toBe(segments[i + 1]!.enteredAt.getTime());
        }
        expect(segments.at(-1)?.exitedAt).toBeNull();
      }),
      RUNS,
    );
  });

  it("P4 — 이력이 0건이면 구간은 1개이고 그 exitedAt은 null이다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 401, max: 900 }),
        (createdOffset, nowOffset) => {
          const segments = calculateDwellSegments(
            new Date(BASE + createdOffset * DAY),
            [],
            new Date(BASE + nowOffset * DAY),
          );
          expect(segments).toHaveLength(1);
          expect(segments[0]!.exitedAt).toBeNull();
          expect(segments[0]!.stage).toBe("DISCOVERY");
        },
      ),
      RUNS,
    );
  });
});
