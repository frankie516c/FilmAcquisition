/**
 * C3 PipelineComponent — 단계 전환과 이력.
 *
 * 트랜잭션 T1: 단계 갱신과 이력 append를 하나로 묶는다.
 * 단계만 바뀌고 이력이 누락되면 "체류 일수 총합 = 경과 일수" 속성이 깨진다.
 */

import { runInTransaction } from "@/platform/db";
import { requireRole, type Ctx } from "@/platform/context";
import { NotFoundError, ValidationError } from "@/platform/errors";
import { isValidTransition, type Stage } from "@/domain/pipeline-rules";

export async function changeStage(
  ctx: Ctx,
  titleId: string,
  toStage: Stage,
  note?: string,
) {
  // 진입 즉시 권한 확인. Executive는 여기서 차단된다 (US-007).
  requireRole(ctx, "SCOUT", "ANALYST");

  return runInTransaction(async (tx) => {
    const title = await tx.title.findUnique({ where: { id: titleId } });
    if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

    const from = title.stage as Stage;
    if (!isValidTransition(from, toStage)) {
      throw new ValidationError([
        { path: "toStage", code: "SAME_STAGE", message: "이미 해당 단계입니다." },
      ]);
    }

    await tx.stageTransition.create({
      data: {
        titleId,
        fromStage: from,
        toStage,
        changedById: ctx.userId,
        occurredAt: ctx.now,
        note: note?.trim() || null,
      },
    });

    return tx.title.update({ where: { id: titleId }, data: { stage: toStage } });
  });
}
