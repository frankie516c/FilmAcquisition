/**
 * S9 — 마지막 경영진 보호 (트랜잭션 T6)
 *
 * ⚠️ 이 테스트는 **사용자 역할을 실제로 변경**합니다.
 *    실패하거나 중단되어도 원래 역할로 되돌리도록 afterAll에 복구를 둡니다.
 *    복구가 실패하면 이후 다른 테스트의 권한 검증이 전부 거짓 실패하므로,
 *    복구 자체를 검증하는 테스트도 마지막에 둡니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, loginAll, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** 테스트 시작 시점의 역할 — 끝나면 이 상태로 되돌린다 */
let original: UserRow[] = [];

async function listUsers(): Promise<UserRow[]> {
  const res = await api<{ users: UserRow[] }>(sessions.EXECUTIVE, "GET", "/api/users");
  expect(res.status).toBe(200);
  return res.body.users;
}

async function setRole(userId: string, role: Role) {
  return api(sessions.EXECUTIVE, "PATCH", `/api/users/${userId}`, { role });
}

beforeAll(async () => {
  sessions = await loginAll();
  original = await listUsers();

  const execs = original.filter((u) => u.role === "EXECUTIVE");
  if (execs.length < 2) {
    throw new Error(
      `이 테스트는 경영진 2명 이상을 전제합니다. 현재 ${execs.length}명. 시드를 확인하세요.`,
    );
  }
}, 60_000);

afterAll(async () => {
  // 원래 역할로 복구 — 실패해도 최대한 시도한다
  for (const u of original) {
    await setRole(u.id, u.role).catch(() => undefined);
  }
});

describe("S9 마지막 경영진 보호", () => {
  it("경영진이 2명 이상이면 강등이 정상 처리된다", async () => {
    const execs = (await listUsers()).filter((u) => u.role === "EXECUTIVE");
    const victim = execs.find((u) => u.id !== sessions.EXECUTIVE.userId)!;

    const res = await setRole(victim.id, "SCOUT");
    expect(res.status).toBe(200);

    const after = (await listUsers()).filter((u) => u.role === "EXECUTIVE");
    expect(after).toHaveLength(execs.length - 1);
  });

  it("★ 마지막 경영진의 역할 변경은 409로 거부된다", async () => {
    const execs = (await listUsers()).filter((u) => u.role === "EXECUTIVE");
    expect(execs).toHaveLength(1); // 앞 테스트가 1명으로 줄여 놓았다

    const last = execs[0]!;
    const res = await api<{ error: { code: string; message: string } }>(
      sessions.EXECUTIVE,
      "PATCH",
      `/api/users/${last.id}`,
      { role: "SCOUT" },
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_EXECUTIVE");
    expect(res.body.error.message).toContain("최소 1명");

    // 실제로 바뀌지 않았는지 확인
    const stillExec = (await listUsers()).find((u) => u.id === last.id);
    expect(stillExec?.role).toBe("EXECUTIVE");
  });

  it("★ 마지막 경영진의 삭제도 409로 거부된다", async () => {
    const last = (await listUsers()).find((u) => u.role === "EXECUTIVE")!;

    const res = await api<{ error: { code: string } }>(
      sessions.EXECUTIVE,
      "DELETE",
      `/api/users/${last.id}`,
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_EXECUTIVE");

    // 계정이 남아 있어야 한다
    expect((await listUsers()).some((u) => u.id === last.id)).toBe(true);
  });

  it("다른 역할을 경영진으로 승격하는 것은 보호 대상이 아니다", async () => {
    const users = await listUsers();
    const promoted = users.find((u) => u.role !== "EXECUTIVE")!;

    const res = await setRole(promoted.id, "EXECUTIVE");
    expect(res.status).toBe(200);

    // 이제 2명이므로 다시 강등할 수 있다
    const back = await setRole(promoted.id, promoted.role);
    expect(back.status).toBe(200);
  });

  it("복구 후 역할이 원래대로 돌아온다", async () => {
    // afterAll 이전에 명시적으로 복구하고 확인한다.
    // 복구가 안 되면 이후 실행에서 다른 테스트가 전부 거짓 실패한다.
    for (const u of original) await setRole(u.id, u.role);

    const now = await listUsers();
    for (const before of original) {
      const after = now.find((u) => u.id === before.id);
      expect(after?.role, `${before.email}`).toBe(before.role);
    }
  });
});
