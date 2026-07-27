/**
 * D2 — 단계 체류 일수 산출.
 *
 * ⚠️ import 금지 구역 — 외부 의존(프레임워크·DB·HTTP·Prisma)은 없다.
 *    같은 domain 디렉터리 안의 원시 함수(calendar, pipeline-rules)만 참조한다.
 *    설계 문서는 "도메인 모듈끼리도 의존하지 않는다"고 했으나, dayIndex를 두 곳에
 *    복제하면 정의가 어긋날 때 D2·D3의 속성이 조용히 깨진다. 복제보다 공유가 안전해
 *    calendar.ts를 공통 원시로 두었다. (설계 문서와의 의도적 차이)
 *
 * 설계 근거: business-logic-model.md 3절
 */

import { dayIndex } from "./calendar";
import { isTerminal, STAGES, type Stage } from "./pipeline-rules";

export interface TransitionRecord {
  /** 작품 최초 생성 시 null */
  fromStage: Stage | null;
  toStage: Stage;
  occurredAt: Date;
}

export interface DwellSegment {
  stage: Stage;
  enteredAt: Date;
  /** 현재 진행 중인 구간이면 null */
  exitedAt: Date | null;
  days: number;
}

/**
 * 이력을 구간으로 분할하고 각 구간의 체류 일수를 계산한다.
 *
 * 핵심 성질: 구간 경계가 인접 구간과 공유되므로 days의 총합이
 * dayIndex(now) − dayIndex(createdAt) 과 정확히 일치한다 (망원 급수).
 *
 * @param now 현재 시각. 전역 시각을 읽지 않고 주입받는다.
 */
export function calculateDwellSegments(
  createdAt: Date,
  transitions: readonly TransitionRecord[],
  now: Date,
): DwellSegment[] {
  // 입력 순서를 신뢰하지 않는다
  const sorted = [...transitions].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const boundaries: Date[] = [createdAt, ...sorted.map((t) => t.occurredAt), now];
  const segments: DwellSegment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const enteredAt = boundaries[i]!;
    const next = boundaries[i + 1]!;
    const isLast = i === boundaries.length - 2;

    const stage: Stage =
      i === 0 ? (sorted[0]?.fromStage ?? STAGES[0]) : sorted[i - 1]!.toStage;

    segments.push({
      stage,
      enteredAt,
      exitedAt: isLast ? null : next,
      days: dayIndex(next) - dayIndex(enteredAt),
    });
  }

  return segments;
}

export interface Bottleneck {
  stage: Stage;
  averageDays: number;
}

/**
 * 평균 체류 일수가 가장 긴 단계를 찾는다 (US-018 파이프라인 위젯).
 *
 * 종료 단계(계약체결·반려)는 후보에서 제외한다 — 종료 상태는 계속 머무는 것이
 * 정상이므로 항상 평균이 가장 커져 병목 지표가 무의미해진다.
 *
 * 동점이면 STAGES 순서에서 앞선 단계를 반환해 결과를 결정론적으로 만든다.
 */
export function findBottleneckStage(
  segmentsByTitle: readonly (readonly DwellSegment[])[],
): Bottleneck | null {
  const buckets = new Map<Stage, number[]>();

  for (const segments of segmentsByTitle) {
    for (const segment of segments) {
      if (isTerminal(segment.stage)) continue;
      const list = buckets.get(segment.stage) ?? [];
      list.push(segment.days);
      buckets.set(segment.stage, list);
    }
  }

  let best: Bottleneck | null = null;
  for (const stage of STAGES) {
    const days = buckets.get(stage);
    if (!days || days.length === 0) continue;
    const averageDays = days.reduce((a, b) => a + b, 0) / days.length;
    if (best === null || averageDays > best.averageDays) {
      best = { stage, averageDays };
    }
  }
  return best;
}
