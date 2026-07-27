/**
 * C4 EvaluationComponent — 평가와 코멘트.
 *
 * 트랜잭션 T4: 코멘트 생성과 멘션 알림 생성을 하나로 묶는다.
 * 코멘트는 남았는데 알림이 없는 상태를 방지한다.
 */

import { prisma, runInTransaction } from "@/platform/db";
import { requireRole, type Ctx } from "@/platform/context";
import { ForbiddenError, NotFoundError } from "@/platform/errors";
import type { EvaluationScores } from "@/domain/score";
import { mentionKey } from "@/domain/notification-key";

export interface EvaluationInput extends EvaluationScores {
  overallComment?: string | null;
  screeningVenue?: string | null;
  screeningAttendees?: string | null;
  targetAudience?: string | null;
}

export async function createEvaluation(ctx: Ctx, titleId: string, input: EvaluationInput) {
  requireRole(ctx, "SCOUT");

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  // 기존 평가를 덮어쓰지 않는다 — 평가자별로 나란히 보존한다 (US-009)
  return prisma.evaluation.create({
    data: { titleId, evaluatorId: ctx.userId, ...input },
  });
}

/**
 * 본문에서 @멘션 토큰을 뽑는다.
 * 한글 이름을 쓰므로 공백·문장부호 전까지를 이름으로 본다.
 */
export function extractMentionNames(body: string): string[] {
  const matches = body.matchAll(/@([^\s@.,!?;:()[\]{}'"]+)/g);
  return [...new Set([...matches].map((m) => m[1]!))];
}

export async function createComment(ctx: Ctx, titleId: string, body: string) {
  requireRole(ctx, "SCOUT", "ANALYST", "EXECUTIVE");

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  const names = extractMentionNames(body);
  const mentioned = names.length
    ? await prisma.user.findMany({ where: { name: { in: names } } })
    : [];

  return runInTransaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { titleId, authorId: ctx.userId, body },
    });

    for (const user of mentioned) {
      if (user.id === ctx.userId) continue; // 작성자 본인은 제외 (US-012)
      await tx.notification.create({
        data: {
          userId: user.id,
          type: "MENTION",
          titleId,
          commentId: comment.id,
          marker: comment.id, // 화면 표시용
          dedupeKey: mentionKey(comment.id), // 코멘트 하나당 알림 하나
          message: `${ctx.userName}님이 «${title.titleKo}» 코멘트에서 회원님을 언급했습니다`,
        },
      });
    }

    return { comment, notified: mentioned.filter((u) => u.id !== ctx.userId).length };
  });
}

export async function deleteComment(ctx: Ctx, commentId: string): Promise<void> {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError("코멘트를 찾을 수 없습니다.");

  // 동작 권한이 아니라 소유권으로 판정한다 (US-011)
  if (comment.authorId !== ctx.userId) {
    throw new ForbiddenError("본인이 작성한 코멘트만 삭제할 수 있습니다.");
  }
  await prisma.comment.delete({ where: { id: commentId } });
}
