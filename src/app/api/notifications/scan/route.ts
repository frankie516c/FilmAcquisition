import { NextResponse } from "next/server";
import { scanAndNotify } from "@/modules/dataio/notification-service";
import { requireContext } from "@/platform/context";
import { toHttpResponse } from "@/platform/errors";

/**
 * 마감 알림 스캔 트리거.
 *
 * 운영에서는 기동 시 1회 + 일 1회 스케줄로 실행되어야 하지만,
 * 로컬 PoC에는 스케줄러가 범위 밖이므로 수동 트리거로 둔다.
 * 중복 방지가 있으므로 몇 번을 눌러도 알림이 늘지 않는다 — 그 자체가 확인 수단이다.
 */
export async function POST() {
  try {
    const ctx = await requireContext();
    const result = await scanAndNotify(ctx.now);
    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
