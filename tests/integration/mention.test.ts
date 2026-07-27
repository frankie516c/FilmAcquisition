/**
 * S6 — 멘션 알림 (트랜잭션 T4)
 *
 * 언급된 사람에게만 알림이 가고, 작성자 본인에게는 가지 않아야 합니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;
let titleId: string;

interface NotificationRow {
  id: string;
  type: string;
  message: string;
}

async function notificationCount(session: Session): Promise<number> {
  const res = await api<{ notifications: NotificationRow[] }>(
    session,
    "GET",
    "/api/notifications",
  );
  return res.body.notifications.length;
}

beforeAll(async () => {
  sessions = await loginAll();

  const created = await api<{ title: { id: string } }>(sessions.SCOUT, "POST", "/api/titles", {
    titleKo: "[통합테스트] 멘션 검증작",
    productionYear: 2025,
    genres: ["DRAMA"],
  });
  titleId = created.body.title.id;
}, 60_000);

afterAll(async () => {
  // 작품을 지우면 코멘트와 멘션 알림이 cascade로 함께 사라진다
  if (titleId) await deleteTitle(sessions.SCOUT, titleId);
});

describe("S6 멘션 알림", () => {
  it("코멘트 작성은 전 역할이 할 수 있다", async () => {
    for (const role of ["SCOUT", "ANALYST", "EXECUTIVE"] as const) {
      const res = await api(sessions[role], "POST", `/api/titles/${titleId}/comments`, {
        body: `${role} 역할의 코멘트입니다`,
      });
      expect(res.status, role).toBe(201);
    }
  });

  it("언급된 사람에게만 알림이 생긴다", async () => {
    const before = {
      analyst: await notificationCount(sessions.ANALYST),
      exec: await notificationCount(sessions.EXECUTIVE),
      scout: await notificationCount(sessions.SCOUT),
    };

    const res = await api<{ notified: number }>(
      sessions.SCOUT,
      "POST",
      `/api/titles/${titleId}/comments`,
      { body: `@${sessions.ANALYST.name} 조건 확인 부탁드립니다` },
    );

    expect(res.status).toBe(201);
    expect(res.body.notified).toBe(1);

    expect(await notificationCount(sessions.ANALYST)).toBe(before.analyst + 1);
    expect(await notificationCount(sessions.EXECUTIVE)).toBe(before.exec); // 미언급
    expect(await notificationCount(sessions.SCOUT)).toBe(before.scout); // 작성자
  });

  it("여러 명을 언급하면 각자에게 하나씩 간다", async () => {
    const before = {
      analyst: await notificationCount(sessions.ANALYST),
      exec: await notificationCount(sessions.EXECUTIVE),
    };

    const res = await api<{ notified: number }>(
      sessions.SCOUT,
      "POST",
      `/api/titles/${titleId}/comments`,
      { body: `@${sessions.ANALYST.name} @${sessions.EXECUTIVE.name} 회의 잡겠습니다` },
    );

    expect(res.body.notified).toBe(2);
    expect(await notificationCount(sessions.ANALYST)).toBe(before.analyst + 1);
    expect(await notificationCount(sessions.EXECUTIVE)).toBe(before.exec + 1);
  });

  it("★ 작성자가 자기를 언급해도 알림이 생기지 않는다", async () => {
    const before = await notificationCount(sessions.ANALYST);

    const res = await api<{ notified: number }>(
      sessions.ANALYST,
      "POST",
      `/api/titles/${titleId}/comments`,
      { body: `@${sessions.ANALYST.name} 내가 나를 언급` },
    );

    expect(res.status).toBe(201);
    expect(res.body.notified).toBe(0);
    expect(await notificationCount(sessions.ANALYST)).toBe(before);
  });

  it("존재하지 않는 이름을 언급해도 코멘트는 정상 작성된다", async () => {
    const res = await api<{ notified: number }>(
      sessions.SCOUT,
      "POST",
      `/api/titles/${titleId}/comments`,
      { body: "@없는사람 확인 부탁드립니다" },
    );

    // 오류가 아니다 — 코멘트에 @가 우연히 들어갈 수 있고,
    // 그것 때문에 작성이 실패하면 안 된다
    expect(res.status).toBe(201);
    expect(res.body.notified).toBe(0);
  });

  it("빈 코멘트는 400이다", async () => {
    const res = await api(sessions.SCOUT, "POST", `/api/titles/${titleId}/comments`, {
      body: "   ",
    });
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 작품에는 코멘트를 달 수 없다", async () => {
    const res = await api(sessions.SCOUT, "POST", "/api/titles/ghost00000000000000000/comments", {
      body: "유령 작품",
    });
    expect(res.status).toBe(404);
  });
});
