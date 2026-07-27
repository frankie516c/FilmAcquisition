/**
 * 작품·파이프라인·딜 조회 리포지토리.
 *
 * 서비스는 Prisma 타입을 직접 import 하지 않는다. 이 파일이 유일한 접점이다
 * (설계 위반 판정 #2).
 */

import { prisma } from "@/platform/db";
import type { Stage } from "@/domain/pipeline-rules";

export interface TitleFilter {
  stage?: Stage;
  q?: string;
}

/** 목록·칸반·대시보드가 공유하는 조회. 딜은 오퍼 금액 집계에 필요하다. */
export function listTitles(filter: TitleFilter = {}) {
  return prisma.title.findMany({
    where: {
      ...(filter.stage ? { stage: filter.stage } : {}),
      ...(filter.q
        ? {
            OR: [
              { titleKo: { contains: filter.q, mode: "insensitive" as const } },
              { titleOriginal: { contains: filter.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      evaluations: true,
      deal: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findTitleDetail(id: string) {
  return prisma.title.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      evaluations: { include: { evaluator: { select: { id: true, name: true, role: true } } } },
      comments: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
      festivalRecords: { orderBy: { year: "desc" } },
      // 이력 화면이 변경자와 사유를 표시한다 (US-008)
      stageTransitions: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "asc" },
      },
      rightsGrants: true,
      deal: true,
      financialModel: true,
    },
  });
}

/** 대시보드 집계용 — 이력이 필요하므로 별도 조회 */
export function listTitlesWithHistory() {
  return prisma.title.findMany({
    include: { stageTransitions: { orderBy: { occurredAt: "asc" } }, deal: true },
  });
}

export function listRightsWithTitle() {
  return prisma.rightsGrant.findMany({ include: { title: { select: { id: true, titleKo: true } } } });
}

export function findTitleById(id: string) {
  return prisma.title.findUnique({ where: { id } });
}
