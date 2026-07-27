/**
 * C7 DataIOComponent — 알림 센터와 마감 알림 스캔.
 *
 * 트랜잭션 T7: 중복 확인과 생성을 묶는다. 다만 최종 방어선은
 * Notification의 UNIQUE 제약이다 — 스캔이 동시에 두 번 실행되면
 * 두 조회가 모두 "없음"을 반환할 수 있기 때문이다.
 */

import { prisma } from "@/platform/db";
import type { Ctx } from "@/platform/context";
import { NotFoundError } from "@/platform/errors";
import {
  calculateDDay,
  deadlineMarker,
  OFFER_THRESHOLDS,
  RIGHTS_THRESHOLDS,
  shouldNotify,
} from "@/domain/deadline";
import { deadlineKey } from "@/domain/notification-key";

export function listNotifications(ctx: Ctx) {
  return prisma.notification.findMany({
    where: { userId: ctx.userId },
    include: { title: { select: { id: true, titleKo: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export function countUnread(ctx: Ctx) {
  return prisma.notification.count({ where: { userId: ctx.userId, isRead: false } });
}

export async function markAsRead(ctx: Ctx, id: string): Promise<void> {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) throw new NotFoundError("알림을 찾을 수 없습니다.");
  // 남의 알림은 조용히 무시하지 않고 없는 것으로 취급한다
  if (n.userId !== ctx.userId) throw new NotFoundError("알림을 찾을 수 없습니다.");
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllAsRead(ctx: Ctx): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId: ctx.userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

export interface ScanResult {
  created: number;
  skipped: number;
}

/**
 * 마감 알림 스캔 — 시스템 실행(기동 시 1회 + 일 1회).
 * 사용자 컨텍스트 없이 동작하므로 now를 인자로 받는다.
 */
export async function scanAndNotify(now: Date): Promise<ScanResult> {
  let created = 0;
  let skipped = 0;

  const deals = await prisma.deal.findMany({
    where: { offerExpiryDate: { not: null } },
    include: { title: { select: { id: true, titleKo: true, assigneeId: true } } },
  });

  for (const deal of deals) {
    const dDay = calculateDDay(now, deal.offerExpiryDate!);
    if (!shouldNotify(dDay, OFFER_THRESHOLDS)) continue;
    const outcome = await createOnce({
      userId: deal.title.assigneeId,
      type: "OFFER_EXPIRY",
      titleId: deal.title.id,
      marker: deadlineMarker(dDay),
      dedupeKey: deadlineKey("OFFER_EXPIRY", deal.title.id, dDay),
      message: `«${deal.title.titleKo}» 오퍼 유효기간 ${deadlineMarker(dDay)}`,
    });
    outcome ? created++ : skipped++;
  }

  const rights = await prisma.rightsGrant.findMany({
    include: { title: { select: { id: true, titleKo: true, assigneeId: true } } },
  });

  for (const grant of rights) {
    const dDay = calculateDDay(now, grant.contractEndDate);
    if (!shouldNotify(dDay, RIGHTS_THRESHOLDS)) continue;
    const outcome = await createOnce({
      userId: grant.title.assigneeId,
      type: "RIGHTS_EXPIRY",
      titleId: grant.title.id,
      marker: deadlineMarker(dDay),
      dedupeKey: deadlineKey("RIGHTS_EXPIRY", grant.title.id, dDay),
      message: `«${grant.title.titleKo}» 판권 계약 만료 ${deadlineMarker(dDay)}`,
    });
    outcome ? created++ : skipped++;
  }

  return { created, skipped };
}

/**
 * 중복이면 생성하지 않고 false를 반환한다.
 *
 * UNIQUE 제약 위반(P2002)을 잡아 처리하므로, 조회-생성 사이의 경쟁 상태에서도
 * 중복이 만들어지지 않는다. 사전 조회만으로는 막을 수 없는 구간이다.
 */
async function createOnce(input: {
  userId: string | null;
  type: "OFFER_EXPIRY" | "RIGHTS_EXPIRY";
  titleId: string;
  marker: string;
  dedupeKey: string;
  message: string;
}): Promise<boolean> {
  if (!input.userId) return false; // 담당자가 없으면 보낼 대상이 없다

  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        titleId: input.titleId,
        marker: input.marker,
        dedupeKey: input.dedupeKey,
        message: input.message,
      },
    });
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}
