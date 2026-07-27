/**
 * C7 DataIOComponent — 리포트.
 *
 * ⚠️ 설계와의 차이 (US-025)
 * 요구사항은 "PDF는 서버에서 생성하며 한글이 깨짐 없이 렌더링"이었다.
 * 서버 PDF 생성은 한글 TTF를 저장소에 함께 넣어야 하는데(수 MB), 로컬 PoC에서
 * 그 비용 대비 이득이 없다고 판단해 **인쇄용 화면 + 브라우저 인쇄(PDF로 저장)** 로 대체했다.
 * 브라우저가 시스템 한글 폰트를 쓰므로 깨짐 문제 자체가 발생하지 않는다.
 * 서버 생성이 필요해지면 이 서비스가 만드는 데이터 구조를 그대로 쓰면 된다.
 *
 * Excel은 BOM 포함 CSV로 제공한다. Excel이 UTF-8로 인식해 한글이 정상 표시된다.
 */

import { requireRole, type Ctx } from "@/platform/context";
import {
  getPipelineOverview,
  getPortfolioComposition,
  getUpcomingDeadlines,
} from "@/modules/dashboard/service";
import { listTitles } from "@/modules/titles/repository";
import { calculateOverallScore } from "@/domain/score";
import { getStageLabel, type Stage } from "@/domain/pipeline-rules";
import { formatDate } from "@/domain/calendar";
import { NotFoundError } from "@/platform/errors";

export const REPORT_KINDS = ["pipeline", "portfolio", "titles"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABELS: Record<ReportKind, string> = {
  pipeline: "파이프라인 현황 요약",
  portfolio: "포트폴리오 구성 요약",
  titles: "작품 상세 시트",
};

export interface ReportSection {
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface Report {
  kind: ReportKind;
  title: string;
  /** 머리말 — 생성 시각과 생성자 (US-025) */
  generatedAt: string;
  generatedBy: string;
  sections: ReportSection[];
}

export async function generateReport(ctx: Ctx, kind: ReportKind): Promise<Report> {
  requireRole(ctx, "ANALYST", "EXECUTIVE");
  if (!REPORT_KINDS.includes(kind)) throw new NotFoundError("리포트 종류가 올바르지 않습니다.");

  const base = {
    kind,
    title: REPORT_LABELS[kind],
    generatedAt: `${formatDate(ctx.now)} ${ctx.now.toTimeString().slice(0, 5)}`,
    generatedBy: ctx.userName,
  };

  if (kind === "pipeline") {
    const overview = await getPipelineOverview(ctx);
    const deadlines = await getUpcomingDeadlines(ctx, 30);
    return {
      ...base,
      sections: [
        {
          heading: "단계별 현황",
          columns: ["단계", "작품 수", "총 오퍼 금액"],
          rows: overview.stages.map((s) => [
            getStageLabel(s.stage),
            String(s.count),
            s.offerTotal > 0n ? s.offerTotal.toString() : "-",
          ]),
        },
        {
          heading: "병목 구간",
          columns: ["단계", "평균 체류 일수"],
          rows: overview.bottleneck
            ? [[getStageLabel(overview.bottleneck.stage), String(Math.round(overview.bottleneck.averageDays))]]
            : [["-", "-"]],
        },
        {
          heading: "30일 내 마감 예정",
          columns: ["작품", "유형", "마감일", "D-day"],
          rows: deadlines.map((d) => [
            d.titleKo,
            d.kind,
            formatDate(d.date),
            d.dDay < 0 ? `${-d.dDay}일 경과` : `D-${d.dDay}`,
          ]),
        },
      ],
    };
  }

  if (kind === "portfolio") {
    const closed = await getPortfolioComposition(ctx, "CLOSED_WON");
    const all = await getPortfolioComposition(ctx, "ALL");
    return {
      ...base,
      sections: [
        {
          heading: `계약체결 기준 장르 분포 (${closed.poolSize}편)`,
          columns: ["장르", "작품 수"],
          rows: closed.genreCounts.map((g) => [g.label, String(g.count)]),
        },
        {
          heading: "라인업 갭",
          columns: ["확보되지 않은 주요 장르"],
          rows: closed.gaps.length ? closed.gaps.map((g) => [g]) : [["없음"]],
        },
        {
          heading: `전체 파이프라인 기준 장르 분포 (${all.poolSize}편)`,
          columns: ["장르", "작품 수"],
          rows: all.genreCounts.map((g) => [g.label, String(g.count)]),
        },
      ],
    };
  }

  const titles = await listTitles();
  return {
    ...base,
    sections: [
      {
        heading: `작품 목록 (${titles.length}편)`,
        columns: ["제목", "원제", "감독", "제작연도", "단계", "담당자", "종합점수", "오퍼금액"],
        rows: titles.map((t) => [
          t.titleKo,
          t.titleOriginal ?? "",
          t.director ?? "",
          String(t.productionYear),
          getStageLabel(t.stage as Stage),
          t.assignee?.name ?? "",
          calculateOverallScore(t.evaluations)?.score.toFixed(1) ?? "미평가",
          t.deal?.offerAmount?.toString() ?? "",
        ]),
      },
    ],
  };
}
