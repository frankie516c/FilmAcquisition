/**
 * S7 — 마감 알림 중복 방지 (자동화)
 *
 * 스캔을 반복 실행해도 알림이 늘지 않아야 합니다.
 * 이 테스트는 시드 데이터의 알림 상태를 바꾸므로, 실행 후 알림 수가 늘 수 있습니다
 * (스캔이 만든 알림은 정상 동작의 결과이며 오염이 아닙니다).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { api, loginAll, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;

interface ScanResult {
  created: number;
  skipped: number;
}

beforeAll(async () => {
  sessions = await loginAll();
}, 60_000);

describe("S7 마감 알림 중복 방지", () => {
  it("첫 스캔 이후 재실행은 아무것도 만들지 않는다", async () => {
    // 1회차 — 이미 스캔된 상태일 수 있으므로 결과를 단정하지 않는다
    const first = await api<ScanResult>(sessions.EXECUTIVE, "POST", "/api/notifications/scan");
    expect(first.status).toBe(200);

    // 2회차 — 1회차가 무엇을 만들었든 전부 중복이어야 한다
    const second = await api<ScanResult>(sessions.EXECUTIVE, "POST", "/api/notifications/scan");
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(0);

    // 3회차 — 여전히 0
    const third = await api<ScanResult>(sessions.EXECUTIVE, "POST", "/api/notifications/scan");
    expect(third.body.created).toBe(0);

    // 2·3회차의 건너뛴 수가 같아야 한다 (대상 집합이 변하지 않았으므로)
    expect(third.body.skipped).toBe(second.body.skipped);
  });

  it("스캔을 반복해도 알림 총수가 변하지 않는다", async () => {
    const countFor = async (session: Session) => {
      const res = await api<{ notifications: unknown[] }>(session, "GET", "/api/notifications");
      return res.body.notifications.length;
    };

    const before = await Promise.all([
      countFor(sessions.SCOUT),
      countFor(sessions.ANALYST),
      countFor(sessions.EXECUTIVE),
    ]);

    await api(sessions.EXECUTIVE, "POST", "/api/notifications/scan");
    await api(sessions.EXECUTIVE, "POST", "/api/notifications/scan");

    const after = await Promise.all([
      countFor(sessions.SCOUT),
      countFor(sessions.ANALYST),
      countFor(sessions.EXECUTIVE),
    ]);

    expect(after).toEqual(before);
  });

  it("멘션 알림도 코멘트 하나당 하나만 생긴다", async () => {
    // 검증용 작품을 만들고 멘션 코멘트를 단다
    const created = await api<{ title: { id: string } }>(sessions.SCOUT, "POST", "/api/titles", {
      titleKo: "[통합테스트] 알림 중복 검증작",
      productionYear: 2025,
      genres: ["DRAMA"],
    });
    const titleId = created.body.title.id;

    try {
      const analystName = sessions.ANALYST.name;

      const before = await api<{ notifications: unknown[] }>(
        sessions.ANALYST,
        "GET",
        "/api/notifications",
      );

      // 같은 사람을 두 번 언급한다 — 알림은 1건이어야 한다
      const res = await api<{ notified: number }>(
        sessions.SCOUT,
        "POST",
        `/api/titles/${titleId}/comments`,
        { body: `@${analystName} @${analystName} 확인 부탁드립니다` },
      );
      expect(res.status).toBe(201);
      expect(res.body.notified).toBe(1);

      const after = await api<{ notifications: unknown[] }>(
        sessions.ANALYST,
        "GET",
        "/api/notifications",
      );
      expect(after.body.notifications.length).toBe(before.body.notifications.length + 1);
    } finally {
      // 작품을 지우면 코멘트와 멘션 알림이 cascade로 함께 사라진다
      await api(sessions.SCOUT, "DELETE", `/api/titles/${titleId}`);
    }
  });
});
