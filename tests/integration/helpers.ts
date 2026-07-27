/**
 * 통합 테스트 헬퍼 — 실행 중인 서버에 실제 HTTP 요청을 보낸다.
 *
 * 단위·속성 테스트와 달리 **서버와 DB가 떠 있어야** 동작한다.
 * 실행: npm run test:integration  (BASE_URL 환경변수로 대상 변경 가능)
 */

// ⚠️ 변수명이 BASE_URL이면 안 된다 — Vite가 `BASE_URL`을 "/"로 미리 정의하므로
//    process.env.BASE_URL이 항상 "/"가 되어 요청 URL이 "//api/..."로 깨진다.
//    프로젝트 접두어를 붙여 충돌을 피한다.
// ?? 가 아니라 || 를 쓰는 이유: 빈 문자열도 "값 없음"으로 취급해야 한다.
const BASE = process.env.FAD_BASE_URL || "http://localhost:3100";
const PASSWORD = process.env.FAD_SEED_PASSWORD || process.env.SEED_PASSWORD || "demo1234";

export type Role = "SCOUT" | "ANALYST" | "EXECUTIVE";

export interface Session {
  cookie: string;
  role: Role;
  userId: string;
  name: string;
}

export interface Res<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

/**
 * 로그인해 세션을 만든다.
 *
 * ⚠️ 역할은 이메일이 아니라 **로그인 응답의 role**로 판정한다.
 * 실행 중인 앱에서 역할이 바뀔 수 있어, 이메일로 역할을 가정하면 테스트가 거짓 실패한다.
 * (실제로 겪은 오진: analyst@fad.local이 SCOUT으로 바뀌어 있었다)
 */
export async function login(email: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`로그인 실패: ${email} → ${res.status}. 서버와 시드 데이터를 확인하세요.`);
  }

  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Set-Cookie 헤더가 없습니다.");
  const cookie = setCookie.split(";")[0]!;

  const body = (await res.json()) as { user: { id: string; role: Role; name: string } };
  return { cookie, role: body.user.role, userId: body.user.id, name: body.user.name };
}

export async function api<T = unknown>(
  session: Session | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<Res<T>> {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = session.cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* CSV·HTML 응답은 문자열 그대로 */
  }

  return { status: res.status, body: parsed as T, headers: res.headers };
}

/**
 * 응답을 **바이트 그대로** 가져온다.
 *
 * `Response.text()`는 UTF-8 디코드 규격에 따라 **선두 BOM을 제거**한다.
 * 따라서 BOM이 실제로 전송되는지는 text()로 검증할 수 없다. 바이트를 봐야 한다.
 */
export async function rawBytes(session: Session, path: string): Promise<Uint8Array> {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: session.cookie } });
  return new Uint8Array(await res.arrayBuffer());
}

/** 서버 렌더 화면의 HTML을 가져온다 */
export async function page(session: Session, path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: session.cookie },
    redirect: "manual",
  });
  return res.text();
}

/** 세 역할의 세션을 한 번에 만든다 */
export async function loginAll(): Promise<Record<Role, Session>> {
  const [scout, analyst, exec] = await Promise.all([
    login("scout1@fad.local"),
    login("analyst@fad.local"),
    login("exec1@fad.local"),
  ]);

  const byRole = { [scout.role]: scout, [analyst.role]: analyst, [exec.role]: exec } as Record<
    Role,
    Session
  >;

  // 시드 역할이 바뀌어 있으면 권한 테스트가 무의미해지므로 여기서 멈춘다
  for (const role of ["SCOUT", "ANALYST", "EXECUTIVE"] as const) {
    if (!byRole[role]) {
      throw new Error(
        `${role} 역할의 세션을 만들지 못했습니다. 데모 계정의 역할이 변경된 것으로 보입니다.\n` +
          `현재: scout1=${scout.role}, analyst=${analyst.role}, exec1=${exec.role}`,
      );
    }
  }
  return byRole;
}

/** 정리용 — 생성한 작품을 지운다 (Scout 권한 필요) */
export async function deleteTitle(scout: Session, titleId: string): Promise<void> {
  await api(scout, "DELETE", `/api/titles/${titleId}`);
}

export const BASE_URL = BASE;
