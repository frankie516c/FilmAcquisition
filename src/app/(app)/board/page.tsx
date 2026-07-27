import { requireContext } from "@/platform/context";
import { listTitles } from "@/modules/titles/repository";
import { canPerform, ROLE_LABELS } from "@/platform/authz/policy";
import { calculateOverallScore } from "@/domain/score";
import { getStageLabel, STAGES, type Stage } from "@/domain/pipeline-rules";
import { formatKrw } from "@/domain/calendar";
import Board from "./board";

export default async function BoardPage() {
  const ctx = await requireContext();
  const titles = await listTitles();
  const editable = canPerform(ctx.role, "pipeline:changeStage");

  const columns = STAGES.map((stage) => {
    const bucket = titles.filter((t) => t.stage === stage);
    return {
      stage,
      label: getStageLabel(stage),
      offerTotal: formatKrw(bucket.reduce((sum, t) => sum + (t.deal?.offerAmount ?? 0n), 0n)),
      hasOffers: bucket.some((t) => (t.deal?.offerAmount ?? 0n) > 0n),
      cards: bucket.map((t) => ({
        id: t.id,
        titleKo: t.titleKo,
        assignee: t.assignee?.name ?? "미배정",
        score: calculateOverallScore(t.evaluations)?.score ?? null,
      })),
    };
  });

  return (
    <>
      <div className="phead">
        <h1>파이프라인</h1>
        <p>
          {editable
            ? "카드를 드래그해 단계를 옮길 수 있습니다"
            : "열람 전용 — 단계 변경 권한이 없습니다"}
        </p>
      </div>

      {!editable && (
        <div className="locked">
          현재 역할({ROLE_LABELS[ctx.role]})은 <b>pipeline:changeStage</b> 권한이 없습니다. 카드
          드래그가 비활성화되며, API를 직접 호출해도 403이 반환됩니다.
        </div>
      )}

      <Board columns={columns} editable={editable} />
    </>
  );
}

export type BoardColumn = {
  stage: Stage;
  label: string;
  offerTotal: string;
  hasOffers: boolean;
  cards: { id: string; titleKo: string; assignee: string; score: number | null }[];
};
