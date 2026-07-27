import Link from "next/link";
import { requireContext } from "@/platform/context";
import {
  getPipelineOverview,
  getPortfolioComposition,
  getUpcomingDeadlines,
} from "@/modules/dashboard/service";
import { getStageLabel } from "@/domain/pipeline-rules";
import { formatDate, formatKrw } from "@/domain/calendar";
import type { DeadlineRange } from "@/domain/deadline";

const COUNTRY_LABELS: Record<string, string> = {
  KR: "대한민국", US: "미국", JP: "일본", CN: "중국", FR: "프랑스",
  GB: "영국", DE: "독일", IN: "인도", BR: "브라질",
};

type Search = Promise<{ basis?: string; range?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const basis = params.basis === "ALL" ? "ALL" : "CLOSED_WON";
  const range = ([7, 30, 90].includes(Number(params.range))
    ? Number(params.range)
    : 30) as DeadlineRange;

  const ctx = await requireContext();
  const [pipeline, portfolio, deadlines] = await Promise.all([
    getPipelineOverview(ctx),
    getPortfolioComposition(ctx, basis),
    getUpcomingDeadlines(ctx, range),
  ]);

  const genreMax = Math.max(1, ...portfolio.genreCounts.map((g) => g.count));

  return (
    <>
      <div className="phead">
        <h1>대시보드</h1>
        <p>작품 {pipeline.stages.reduce((s, x) => s + x.count, 0)}편</p>
      </div>

      <div className="grid g3">
        {/* 파이프라인 현황 */}
        <section className="card">
          <header>
            <h3>파이프라인 현황</h3>
            <span className="lbl">US-018</span>
          </header>
          <div className="cbody">
            {pipeline.stages.map((s) => (
              <Link
                key={s.stage}
                href={{ pathname: "/titles", query: { stage: s.stage } }}
                className="stagerow"
              >
                <span className="sname">{getStageLabel(s.stage)}</span>
                <span className="bar">
                  <i style={{ width: `${(s.count / pipeline.maxCount) * 100}%` }} />
                </span>
                <span className="scount">{s.count}</span>
                <span className="samt">{s.offerTotal > 0n ? formatKrw(s.offerTotal) : "—"}</span>
              </Link>
            ))}
            <div
              className="kv"
              style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}
            >
              <span className="k">병목 구간</span>
              <b>
                {pipeline.bottleneck
                  ? `${getStageLabel(pipeline.bottleneck.stage)} · 평균 ${Math.round(
                      pipeline.bottleneck.averageDays,
                    )}일 체류`
                  : "—"}
              </b>
            </div>
            <p className="note" style={{ margin: "8px 0 0" }}>
              단계를 클릭하면 해당 단계로 필터링된 작품 목록으로 이동합니다.
            </p>
          </div>
        </section>

        {/* 포트폴리오 구성 */}
        <section className="card">
          <header>
            <h3>포트폴리오 구성</h3>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Link
                href={{ pathname: "/dashboard", query: { basis: "CLOSED_WON", range } }}
                className={`pill ${basis === "CLOSED_WON" ? "p-acc" : "p-neut"}`}
              >
                계약체결
              </Link>
              <Link
                href={{ pathname: "/dashboard", query: { basis: "ALL", range } }}
                className={`pill ${basis === "ALL" ? "p-acc" : "p-neut"}`}
              >
                전체
              </Link>
            </span>
          </header>
          <div className="cbody">
            <div className="lbl" style={{ marginBottom: 6 }}>
              주요 장르 분포 · 대상 {portfolio.poolSize}편
            </div>
            {portfolio.genreCounts.map((g) => (
              <div className="genrow" key={g.code}>
                <span className="gname">{g.label}</span>
                <span className="gbar">
                  <i style={{ width: `${(g.count / genreMax) * 100}%` }} />
                </span>
                <span className="gn">{g.count}</span>
              </div>
            ))}
            <div className="lbl" style={{ margin: "12px 0 6px" }}>
              제작국가
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {portfolio.countryCounts.length === 0 && <span className="note">—</span>}
              {portfolio.countryCounts.map((c) => (
                <span className="pill p-neut" key={c.code}>
                  {COUNTRY_LABELS[c.code] ?? c.code} {c.count}
                </span>
              ))}
            </div>
            {portfolio.gaps.length > 0 && (
              <div className="gapnote">
                <b>라인업 갭</b> — {portfolio.gaps.join(" · ")} 장르에 확보된 작품이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* 마감 임박 */}
        <section className="card">
          <header>
            <h3>마감 임박</h3>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {([7, 30, 90] as const).map((r) => (
                <Link
                  key={r}
                  href={{ pathname: "/dashboard", query: { basis, range: r } }}
                  className={`pill ${range === r ? "p-acc" : "p-neut"}`}
                >
                  {r}일
                </Link>
              ))}
            </span>
          </header>
          <div className="cbody">
            {deadlines.length === 0 && (
              <p className="note">이 기간에 마감 예정 항목이 없습니다.</p>
            )}
            {deadlines.map((d, i) => (
              <div className="dl" key={`${d.titleId}-${d.kind}-${i}`}>
                <div className="t">
                  <b>{d.titleKo}</b>
                  <span>
                    {d.kind} · {formatDate(d.date)}
                  </span>
                </div>
                <span
                  className={`pill ${
                    d.dDay < 0 ? "p-crit" : d.dDay <= 7 ? "p-warn" : "p-neut"
                  }`}
                >
                  {d.dDay < 0 ? `${-d.dDay}일 경과` : d.dDay === 0 ? "오늘" : `D-${d.dDay}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
