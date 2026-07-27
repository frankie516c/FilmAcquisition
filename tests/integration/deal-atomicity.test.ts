/**
 * U4 — 딜과 재무 저장의 원자성
 *
 * 두 API로 나뉘어 있을 때는 딜만 저장되고 재무가 실패하는 중간 상태가 가능했다.
 * 이 테스트는 그 상태가 더 이상 만들어지지 않음을 증명한다.
 *
 * 자기가 만든 작품으로만 검증하고 정리하므로 시드 데이터를 건드리지 않는다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;
let titleId: string;

const 억 = 100_000_000;

interface DealBody {
  deal: Record<string, unknown> | null;
  financials: Record<string, unknown> | null;
}

beforeAll(async () => {
  sessions = await loginAll();

  const res = await api<{ title: { id: string } }>(sessions.SCOUT, "POST", "/api/titles", {
    titleKo: "[통합테스트] 원자성 검증작",
    titleOriginal: "Integration Atomicity Fixture",
    productionYear: 2025,
    genres: ["DRAMA"],
  });
  expect(res.status).toBe(201);
  titleId = res.body.title.id;
}, 60_000);

afterAll(async () => {
  if (titleId) await deleteTitle(sessions.SCOUT, titleId);
});

/** 현재 저장된 딜의 MG를 읽는다. 딜이 없으면 null */
async function currentMg(): Promise<string | null> {
  const res = await api<DealBody>(sessions.ANALYST, "PUT", `/api/titles/${titleId}/deal`, {});
  return (res.body.deal?.minimumGuarantee as string | undefined) ?? null;
}

describe("U4 딜·재무 저장의 원자성", () => {
  it("정상 입력은 딜과 재무가 함께 저장된다", async () => {
    const res = await api<DealBody>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal-financials`,
      {
        deal: { offerAmount: String(9 * 억), minimumGuarantee: String(8 * 억) },
        financials: {
          paAndBudget: String(14 * 억),
          otherCosts: String(2 * 억),
          expectedRevenue: String(38 * 억),
        },
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.deal?.minimumGuarantee).toBe(String(8 * 억));
    expect(res.body.financials).not.toBeNull();
    // MG 8억 + P&A 14억 + 기타 2억 = 24억, 매출 38억 → 손익 14억, ROI 58.33%
    expect(res.body.financials?.totalAcquisitionCost).toBe(String(24 * 억));
    expect(res.body.financials?.expectedProfit).toBe(String(14 * 억));
    expect(res.body.financials?.roiPercent).toBeCloseTo(58.33, 2);
  });

  it("재무가 검증에 걸리면 딜도 저장되지 않는다 ★ 핵심", async () => {
    const before = await currentMg();
    expect(before).toBe(String(8 * 억));

    const res = await api<{ error: { code: string; fields: { path: string }[] } }>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal-financials`,
      {
        // 딜은 유효하지만
        deal: { minimumGuarantee: String(99 * 억) },
        // 재무가 음수라 검증에 걸린다
        financials: { paAndBudget: "-1", otherCosts: "0", expectedRevenue: "0" },
      },
    );

    expect(res.status).toBe(400);
    expect(res.body.error.fields.some((f) => f.path.includes("paAndBudget"))).toBe(true);

    // 딜이 바뀌지 않아야 한다 — 나뉜 API였다면 99억으로 이미 저장됐을 것이다
    const after = await currentMg();
    expect(after).toBe(before);
  });

  it("딜이 검증에 걸리면 재무도 저장되지 않는다", async () => {
    const res = await api<{ error: { fields: { path: string }[] } }>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal-financials`,
      {
        // 유효기간이 제출일보다 앞선다
        deal: { offerSubmittedAt: "2026-08-01", offerExpiryDate: "2026-07-01" },
        financials: {
          paAndBudget: String(1 * 억),
          otherCosts: "0",
          expectedRevenue: String(2 * 억),
        },
      },
    );

    expect(res.status).toBe(400);

    // 재무가 이전 값 그대로여야 한다
    const fin = await api<{ financials: Record<string, unknown> }>(
      sessions.ANALYST,
      "GET",
      `/api/titles/${titleId}/financials`,
    );
    expect(fin.body.financials.paAndBudget).toBe(String(14 * 억));
  });

  it("재무 없이 딜만 저장할 수 있다", async () => {
    const res = await api<DealBody>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal-financials`,
      { deal: { contractTerms: "재무 없이 딜만" } },
    );

    expect(res.status).toBe(200);
    expect(res.body.financials).toBeNull(); // 이번 요청에서 재무를 다루지 않았다는 뜻

    // 기존 재무는 지워지지 않는다
    const fin = await api<{ financials: Record<string, unknown> }>(
      sessions.ANALYST,
      "GET",
      `/api/titles/${titleId}/financials`,
    );
    expect(fin.body.financials).not.toBeNull();
  });

  it("재무 계산은 같은 요청에서 방금 저장한 딜을 기준으로 한다", async () => {
    // MG를 10억으로 바꾸면서 재무도 함께 보낸다.
    // 계산이 이전 MG(8억)를 쓰면 총 인수비용이 24억으로 나온다.
    const res = await api<DealBody>(
      sessions.ANALYST,
      "PUT",
      `/api/titles/${titleId}/deal-financials`,
      {
        deal: { minimumGuarantee: String(10 * 억) },
        financials: {
          paAndBudget: String(14 * 억),
          otherCosts: String(2 * 억),
          expectedRevenue: String(38 * 억),
        },
      },
    );

    expect(res.status).toBe(200);
    // 10 + 14 + 2 = 26억 — 새 MG가 반영되어야 한다
    expect(res.body.financials?.totalAcquisitionCost).toBe(String(26 * 억));
  });

  it("Scout와 Executive는 이 엔드포인트를 쓸 수 없다", async () => {
    for (const role of ["SCOUT", "EXECUTIVE"] as const) {
      const res = await api(sessions[role], "PUT", `/api/titles/${titleId}/deal-financials`, {
        deal: { offerAmount: "1" },
      });
      expect(res.status).toBe(403);
    }
  });
});
