import { NextResponse } from "next/server";
import { countUnread, listNotifications, markAllAsRead } from "@/modules/dataio/notification-service";
import { requireContext } from "@/platform/context";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

export async function GET() {
  try {
    const ctx = await requireContext();
    const [items, unread] = await Promise.all([listNotifications(ctx), countUnread(ctx)]);
    return NextResponse.json({
      notifications: serialize(ctx.role, "Notification", items),
      unread,
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** 전체 읽음 처리 */
export async function POST() {
  try {
    const ctx = await requireContext();
    const count = await markAllAsRead(ctx);
    return NextResponse.json({ marked: count });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
