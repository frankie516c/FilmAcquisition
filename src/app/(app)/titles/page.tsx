import Link from "next/link";
import { requireContext } from "@/platform/context";
import { listTitles } from "@/modules/titles/repository";
import { serialize } from "@/platform/authz/serialize";
import { canPerform } from "@/platform/authz/policy";
import ExportButton from "./export-button";
import { calculateOverallScore } from "@/domain/score";
import { getStageLabel, STAGES, type Stage } from "@/domain/pipeline-rules";
import { formatKrw } from "@/domain/calendar";

const GENRE_LABELS: Record<string, string> = {
  DRAMA: "드라마", THRILLER: "스릴러", COMEDY: "코미디", ACTION: "액션",
  ROMANCE: "로맨스", HORROR: "공포", SF: "SF", FANTASY: "판타지",
  ANIMATION: "애니메이션", DOCUMENTARY: "다큐멘터리", MYSTERY: "미스터리", WAR: "전쟁",
};
const COUNTRY_LABELS: Record<string, string> = {
  KR: "대한민국", US: "미국", JP: "일본", CN: "중국", FR: "프랑스",
  GB: "영국", DE: "독일", IN: "인도", BR: "브라질",
};

type Search = Promise<{ stage?: string; q?: string }>;

export default async function TitlesPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const stage = STAGES.includes(params.stage as Stage) ? (params.stage as Stage) : undefined;

  const ctx = await requireContext();
  const titles = await listTitles({ stage, q: params.q });

  return (
    <>
      <div className="phead">
        <h1>작품 목록</h1>
        <p>
          {stage ? `${getStageLabel(stage)} 단계 · ` : "전체 "}
          {titles.length}편
        </p>
        {stage && (
          <Link href="/titles" className="act">
            필터 해제
          </Link>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {canPerform(ctx.role, "title:write") && (
            <Link href="/titles/new" className="act">
              + 작품 등록
            </Link>
          )}
          {canPerform(ctx.role, "import:commit") && (
            <Link href="/titles/import" className="act">
              CSV 가져오기
            </Link>
          )}
          {canPerform(ctx.role, "export:execute") ? (
            <ExportButton stage={stage} />
          ) : (
            <span className="pill p-neut">내보내기 권한 없음</span>
          )}
        </span>
      </div>

      <section className="card">
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>제목</th>
                <th>장르</th>
                <th>제작</th>
                <th>단계</th>
                <th>평가</th>
                <th style={{ textAlign: "right" }}>오퍼 금액</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {titles.map((t) => {
                const score = calculateOverallScore(t.evaluations);
                // 딜은 직렬화 게이트를 통과시킨다 — Scout에게는 MG 등이 애초에 오지 않는다
                const deal = t.deal
                  ? (serialize(ctx.role, "Deal", t.deal) as Record<string, unknown>)
                  : null;

                return (
                  <tr key={t.id}>
                    <td>
                      <b>{t.titleKo}</b>
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>
                        {t.titleOriginal ?? ""}
                      </div>
                    </td>
                    <td>{(t.genres as string[]).map((g) => GENRE_LABELS[g] ?? g).join(", ")}</td>
                    <td>
                      {t.productionCountry
                        ? `${COUNTRY_LABELS[t.productionCountry] ?? t.productionCountry} · `
                        : ""}
                      {t.productionYear}
                    </td>
                    <td>
                      <span className="pill p-acc">{getStageLabel(t.stage as Stage)}</span>
                    </td>
                    <td>
                      {score ? (
                        <>
                          <b>{score.score.toFixed(1)}</b>{" "}
                          <span style={{ color: "var(--faint)", fontSize: 11 }}>
                            ({score.count})
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "var(--faint)" }}>미평가</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {deal?.offerAmount ? formatKrw(deal.offerAmount as string) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link className="act" href={`/titles/${t.id}`}>
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
