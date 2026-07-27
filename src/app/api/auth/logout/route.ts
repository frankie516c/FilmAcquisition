import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logout } from "@/modules/auth/service";
import { SESSION_COOKIE } from "@/platform/context";

export async function POST() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) await logout(sessionId);
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
