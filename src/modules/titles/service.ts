/**
 * C2 TitleComponent — 작품 관리.
 *
 * 트랜잭션 T3: 작품 생성과 최초 단계 이력을 하나로 묶는다.
 *   이력의 시작점이 없으면 체류 일수 계산의 기준이 사라져
 *   "총합 = 등록 후 경과 일수" 속성이 깨진다.
 * 트랜잭션 T2: 작품 삭제와 하위 엔티티 삭제. cascade는 스키마가 처리하지만
 *   삭제 자체는 트랜잭션 안에서 수행해 부분 삭제 상태를 만들지 않는다.
 */

import { prisma, runInTransaction } from "@/platform/db";
import { requireRole, type Ctx } from "@/platform/context";
import { NotFoundError } from "@/platform/errors";

export interface TitleInput {
  titleKo: string;
  titleOriginal?: string | null;
  director?: string | null;
  genres: string[];
  productionCountry?: string | null;
  productionYear: number;
  rating?: string | null;
  runtimeMinutes?: number | null;
  synopsis?: string | null;
  assigneeId?: string | null;
}

/**
 * 원제 + 제작연도가 같은 작품을 찾는다.
 * 차단이 아니라 경고용이다 — 리메이크와 동명이작이 실제로 존재하므로
 * 등록 자체는 허용해야 한다 (US-001).
 */
export async function findDuplicateCandidates(
  _ctx: Ctx,
  titleOriginal: string | null | undefined,
  productionYear: number,
) {
  if (!titleOriginal) return [];
  return prisma.title.findMany({
    where: { titleOriginal, productionYear },
    select: { id: true, titleKo: true, titleOriginal: true, productionYear: true, stage: true },
    take: 5,
  });
}

export async function createTitle(ctx: Ctx, input: TitleInput) {
  requireRole(ctx, "SCOUT");

  return runInTransaction(async (tx) => {
    const title = await tx.title.create({
      data: {
        titleKo: input.titleKo,
        titleOriginal: input.titleOriginal ?? null,
        director: input.director ?? null,
        genres: input.genres as never,
        productionCountry: (input.productionCountry ?? null) as never,
        productionYear: input.productionYear,
        rating: (input.rating ?? null) as never,
        runtimeMinutes: input.runtimeMinutes ?? null,
        synopsis: input.synopsis ?? null,
        assigneeId: input.assigneeId ?? ctx.userId,
        createdAt: ctx.now,
      },
    });

    // 최초 이력 — fromStage가 null인 유일한 레코드다
    await tx.stageTransition.create({
      data: {
        titleId: title.id,
        fromStage: null,
        toStage: "DISCOVERY",
        changedById: ctx.userId,
        occurredAt: ctx.now,
        note: "작품 등록",
      },
    });

    return title;
  });
}

export async function updateTitle(ctx: Ctx, id: string, input: Partial<TitleInput>) {
  requireRole(ctx, "SCOUT");

  const existing = await prisma.title.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("작품을 찾을 수 없습니다.");

  // 단계는 여기서 바꿀 수 없다. 이력이 남지 않는 경로를 만들지 않기 위함이다.
  // 단계 변경은 PipelineService.changeStage만 담당한다.
  return prisma.title.update({
    where: { id },
    data: {
      ...(input.titleKo !== undefined ? { titleKo: input.titleKo } : {}),
      ...(input.titleOriginal !== undefined ? { titleOriginal: input.titleOriginal } : {}),
      ...(input.director !== undefined ? { director: input.director } : {}),
      ...(input.genres !== undefined ? { genres: input.genres as never } : {}),
      ...(input.productionCountry !== undefined
        ? { productionCountry: input.productionCountry as never }
        : {}),
      ...(input.productionYear !== undefined ? { productionYear: input.productionYear } : {}),
      ...(input.rating !== undefined ? { rating: input.rating as never } : {}),
      ...(input.runtimeMinutes !== undefined ? { runtimeMinutes: input.runtimeMinutes } : {}),
      ...(input.synopsis !== undefined ? { synopsis: input.synopsis } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    },
  });
}

export async function deleteTitle(ctx: Ctx, id: string): Promise<void> {
  requireRole(ctx, "SCOUT");

  await runInTransaction(async (tx) => {
    const existing = await tx.title.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("작품을 찾을 수 없습니다.");
    // 평가·코멘트·이력·딜·판권·재무는 스키마의 onDelete: Cascade로 함께 삭제된다
    await tx.title.delete({ where: { id } });
  });
}
