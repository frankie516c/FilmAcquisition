/**
 * C6 DashboardComponent — 위젯 3종의 집계.
 *
 * 재무 값이 필요하면 D1을 호출한다. 산식을 재구현하지 않는다 (NFR-008).
 */

import { listRightsWithTitle, listTitlesWithHistory } from "@/modules/titles/repository";
import { calculateDwellSegments, findBottleneckStage } from "@/domain/dwell-time";
import { calculateDDay, classifyDeadline, type DeadlineRange } from "@/domain/deadline";
import { STAGES, type Stage } from "@/domain/pipeline-rules";
import type { Ctx } from "@/platform/context";

export interface StageSummary {
  stage: Stage;
  count: number;
  offerTotal: bigint;
}

export interface PipelineOverview {
  stages: StageSummary[];
  bottleneck: { stage: Stage; averageDays: number } | null;
  maxCount: number;
}

export async function getPipelineOverview(ctx: Ctx): Promise<PipelineOverview> {
  const titles = await listTitlesWithHistory();

  const stages: StageSummary[] = STAGES.map((stage) => {
    const bucket = titles.filter((t) => t.stage === stage);
    return {
      stage,
      count: bucket.length,
      offerTotal: bucket.reduce((sum, t) => sum + (t.deal?.offerAmount ?? 0n), 0n),
    };
  });

  const segmentsByTitle = titles.map((t) =>
    calculateDwellSegments(
      t.createdAt,
      t.stageTransitions.map((s) => ({
        fromStage: s.fromStage as Stage | null,
        toStage: s.toStage as Stage,
        occurredAt: s.occurredAt,
      })),
      ctx.now,
    ),
  );

  return {
    stages,
    bottleneck: findBottleneckStage(segmentsByTitle),
    maxCount: Math.max(1, ...stages.map((s) => s.count)),
  };
}

/** 라인업 갭 판정 대상. 12개 장르 전부가 아니라 주요 6종만 본다. */
export const MAJOR_GENRES = [
  ["DRAMA", "드라마"],
  ["THRILLER", "스릴러"],
  ["COMEDY", "코미디"],
  ["ACTION", "액션"],
  ["ROMANCE", "로맨스"],
  ["DOCUMENTARY", "다큐멘터리"],
] as const;

export interface PortfolioComposition {
  poolSize: number;
  genreCounts: { code: string; label: string; count: number }[];
  countryCounts: { code: string; count: number }[];
  gaps: string[];
}

export async function getPortfolioComposition(
  _ctx: Ctx,
  basis: "CLOSED_WON" | "ALL",
): Promise<PortfolioComposition> {
  const all = await listTitlesWithHistory();
  const pool = basis === "CLOSED_WON" ? all.filter((t) => t.stage === "CLOSED_WON") : all;

  const genreCounts = MAJOR_GENRES.map(([code, label]) => ({
    code,
    label,
    count: pool.filter((t) => (t.genres as string[]).includes(code)).length,
  }));

  const countryMap = new Map<string, number>();
  for (const t of pool) {
    if (!t.productionCountry) continue;
    countryMap.set(t.productionCountry, (countryMap.get(t.productionCountry) ?? 0) + 1);
  }

  return {
    poolSize: pool.length,
    genreCounts,
    countryCounts: [...countryMap].map(([code, count]) => ({ code, count })),
    gaps: genreCounts.filter((g) => g.count === 0).map((g) => g.label),
  };
}

export interface DeadlineItem {
  titleId: string;
  titleKo: string;
  kind: "오퍼 만료" | "판권 만료";
  date: Date;
  dDay: number;
  status: ReturnType<typeof classifyDeadline>;
}

export async function getUpcomingDeadlines(
  ctx: Ctx,
  rangeDays: DeadlineRange,
): Promise<DeadlineItem[]> {
  const [titles, rights] = await Promise.all([listTitlesWithHistory(), listRightsWithTitle()]);
  const items: DeadlineItem[] = [];

  for (const t of titles) {
    const expiry = t.deal?.offerExpiryDate;
    if (!expiry) continue;
    const dDay = calculateDDay(ctx.now, expiry);
    if (dDay > rangeDays) continue;
    items.push({
      titleId: t.id,
      titleKo: t.titleKo,
      kind: "오퍼 만료",
      date: expiry,
      dDay,
      status: classifyDeadline(dDay, rangeDays),
    });
  }

  for (const r of rights) {
    const dDay = calculateDDay(ctx.now, r.contractEndDate);
    if (dDay > rangeDays) continue;
    items.push({
      titleId: r.title.id,
      titleKo: r.title.titleKo,
      kind: "판권 만료",
      date: r.contractEndDate,
      dDay,
      status: classifyDeadline(dDay, rangeDays),
    });
  }

  return items.sort((a, b) => a.dDay - b.dDay);
}
