import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { login } from "@/modules/auth/service";
import { loginSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { SESSION_COOKIE } from "@/platform/context";
import { serialize } from "@/platform/authz/serialize";

export async function POST(request: Request) {
  try {
    const input = validate(loginSchema, await request.json());
    const session = await login(input.email, input.password);

    // secure 플래그를 NODE_ENV로 판정하면 안 된다.
    // `next start`는 NODE_ENV=production이므로, http://localhost로 접속하는 로컬 실행
    // (NFR-002가 전제하는 바로 그 환경)에서 브라우저가 쿠키를 되돌려 보내지 않아
    // 로그인은 200을 받고도 세션이 유지되지 않는다.
    // 실제 요청 프로토콜로 판정한다. 프록시 뒤라면 x-forwarded-proto를 우선한다.
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const isHttps =
      forwardedProto === "https" || new URL(request.url).protocol === "https:";

    const store = await cookies();
    store.set(SESSION_COOKIE, session.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isHttps,
      // Max-Age·Expires를 지정하지 않는다 → 브라우저 종료 시 쿠키가 소멸한다 (US-026)
    });

    return NextResponse.json({ user: serialize(session.user.role, "User", session.user) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
