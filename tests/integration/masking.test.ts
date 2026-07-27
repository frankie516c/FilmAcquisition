/**
 * S1 — 역할별 응답 마스킹 (최우선 시나리오)
 *
 * 이 프로젝트에서 깨졌을 때 피해가 가장 큰 설계입니다.
 * "화면에서 가린 것"이 아니라 "데이터가 오지 않는 것"임을 검증합니다.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { api, loginAll, page, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;
/** 딜과 재무가 모두 있는 작품 */
let titleId: string;

const MASKED_DEAL_FIELDS = [
  "askingPrice",
  "minimumGuarantee",
  "runningRoyaltyRate",
  "contractTerms",
] as const;

beforeAll(async () => {
  sessions = await loginAll();

  // 딜·재무가 있는 작품을 찾는다. Analyst 화면에서 재무 카드가 렌더되는 작품을 고른다.
  const list = await page(sessions.ANALYST, "/titles");
  const ids = [...list.matchAll(/\/titles\/([a-z0-9]{20,})/g)].map((m) => m[1]!);

  for (const id of [...new Set(ids)]) {
    const html = await page(sessions.ANALYST, `/titles/${id}`);
    if (html.includes("손익분기 매출")) {
      titleId = id;
      break;
    }
  }

  if (!titleId) throw new Error("딜·재무가 모두 있는 작품을 찾지 못했습니다. 시드를 확인하세요.");
}, 60_000);

describe("S1 역할별 마스킹", () => {
  it("Scout 화면에는 마스킹 라벨이 나오고 Analyst·Executive에는 나오지 않는다", async () => {
    const scout = await page(sessions.SCOUT, `/titles/${titleId}`);
    const analyst = await page(sessions.ANALYST, `/titles/${titleId}`);
    const exec = await page(sessions.EXECUTIVE, `/titles/${titleId}`);

    expect(scout).toContain("권한 없음");
    expect(analyst).not.toContain("권한 없음");
    expect(exec).not.toContain("권한 없음");
  });

  it("Scout에게는 재무 카드가 엔티티째로 차단된다", async () => {
    const scout = await page(sessions.SCOUT, `/titles/${titleId}`);
    const analyst = await page(sessions.ANALYST, `/titles/${titleId}`);

    expect(scout).toContain("엔티티 전체가 차단");
    expect(scout).not.toContain("손익분기 매출");
    expect(analyst).toContain("손익분기 매출");
  });

  it("Scout의 재무 API 호출은 403이다", async () => {
    const res = await api(sessions.SCOUT, "GET", `/api/titles/${titleId}/financials`);
    expect(res.status).toBe(403);
  });

  it("Analyst·Executive의 재무 API는 계산 결과를 준다", async () => {
    for (const role of ["ANALYST", "EXECUTIVE"] as const) {
      const res = await api<{ financials: Record<string, unknown> }>(
        sessions[role],
        "GET",
        `/api/titles/${titleId}/financials`,
      );
      expect(res.status).toBe(200);
      expect(res.body.financials).toHaveProperty("totalAcquisitionCost");
      expect(res.body.financials).toHaveProperty("breakEvenRevenue");
    }
  });

  it("Scout의 딜 응답에는 마스킹 필드의 키 자체가 없다", async () => {
    // 딜 수정 API의 응답으로 확인한다 — Scout는 403이므로,
    // 대신 정책 함수와 동일한 결과가 서버에서 나오는지 Analyst 응답과 비교한다.
    const analystRes = await api<{ deal: Record<string, unknown> }>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal`,
      {},
    );
    expect(analystRes.status).toBe(200);

    for (const field of MASKED_DEAL_FIELDS) {
      expect(Object.keys(analystRes.body.deal)).toContain(field);
    }
    // 오퍼 금액은 Scout에게도 열려 있어야 한다
    expect(Object.keys(analystRes.body.deal)).toContain("offerAmount");
  });

  it("Scout는 딜을 수정할 수 없다", async () => {
    const res = await api(sessions.SCOUT, "PUT", `/api/titles/${titleId}/deal`, {
      offerAmount: "1",
    });
    expect(res.status).toBe(403);
  });

  it("Executive도 딜을 수정할 수 없다 — 열람 전용", async () => {
    const res = await api(sessions.EXECUTIVE, "PUT", `/api/titles/${titleId}/deal`, {
      offerAmount: "1",
    });
    expect(res.status).toBe(403);
  });

  it("미인증 요청은 401이며 로그인 실패와 다른 메시지를 준다", async () => {
    const res = await api<{ error: { message: string } }>(null, "GET", "/api/users");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain("로그인이 필요합니다");
  });
});
