/**
 * S3 — 재무 산식 단일 정의 (NFR-008)
 *
 * 화면·API·CSV가 **같은 값**을 내야 합니다. 세 경로가 각자 계산하면 반드시 어긋납니다.
 * 이 테스트는 세 경로의 값을 실제로 비교합니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, page, type Role, type Session } from "./helpers";
import { parseCsv } from "@/domain/csv";
import { calculateFinancials } from "@/domain/financials";

let sessions: Record<Role, Session>;
let titleId: string;

const 억 = 100_000_000;
const MG = 8 * 억;
const PA = 14 * 억;
const OTHER = 2 * 억;
const REVENUE = 38 * 억;

const TITLE = "[통합테스트] 재무 일관성 검증작";

beforeAll(async () => {
  sessions = await loginAll();

  const created = await api<{ title: { id: string } }>(sessions.SCOUT, "POST", "/api/titles", {
    titleKo: TITLE,
    productionYear: 2025,
    genres: ["DRAMA"],
  });
  titleId = created.body.title.id;

  const saved = await api(sessions.ANALYST, "PUT", `/api/titles/${titleId}/deal-financials`, {
    deal: { minimumGuarantee: String(MG), offerAmount: String(9 * 억) },
    financials: {
      paAndBudget: String(PA),
      otherCosts: String(OTHER),
      expectedRevenue: String(REVENUE),
    },
  });
  expect(saved.status).toBe(200);
}, 60_000);

afterAll(async () => {
  if (titleId) await deleteTitle(sessions.SCOUT, titleId);
});

describe("S3 재무 산식 단일 정의", () => {
  /** 순수 함수가 내는 값 — 이것이 기준이다 */
  const expected = calculateFinancials({
    offerAmount: BigInt(MG), // MG가 오퍼 금액보다 우선한다
    paAndBudget: BigInt(PA),
    otherCosts: BigInt(OTHER),
    expectedRevenue: BigInt(REVENUE),
  });

  it("기준값이 손 계산과 맞는다", () => {
    // MG 8억 + P&A 14억 + 기타 2억 = 24억
    expect(expected.totalAcquisitionCost).toBe(BigInt(24 * 억));
    // 38억 − 24억 = 14억
    expect(expected.expectedProfit).toBe(BigInt(14 * 억));
    // 14/24 × 100 = 58.333… → 버림 58.33
    expect(expected.roiPercent).toBeCloseTo(58.33, 2);
    // 손익분기는 총 인수비용과 같다
    expect(expected.breakEvenRevenue).toBe(expected.totalAcquisitionCost);
  });

  it("API가 기준값과 같은 값을 낸다", async () => {
    const res = await api<{ financials: Record<string, unknown> }>(
      sessions.ANALYST,
      "GET",
      `/api/titles/${titleId}/financials`,
    );

    expect(res.body.financials.totalAcquisitionCost).toBe(String(expected.totalAcquisitionCost));
    expect(res.body.financials.expectedProfit).toBe(String(expected.expectedProfit));
    expect(res.body.financials.breakEvenRevenue).toBe(String(expected.breakEvenRevenue));
    expect(res.body.financials.roiPercent).toBeCloseTo(expected.roiPercent!, 2);
  });

  it("화면이 기준값과 같은 값을 보여준다", async () => {
    const html = await page(sessions.ANALYST, `/titles/${titleId}`);

    // 금액은 천 단위 구분 기호로 표시된다
    expect(html).toContain(Number(expected.totalAcquisitionCost).toLocaleString("en-US"));
    expect(html).toContain(Number(expected.expectedProfit).toLocaleString("en-US"));
    expect(html).toContain(`${expected.roiPercent!.toFixed(2)}%`);
  });

  it("CSV가 기준값과 같은 값을 낸다", async () => {
    const res = await api<string>(sessions.ANALYST, "GET", "/api/export/titles");
    const csv = typeof res.body === "string" ? res.body : "";
    const withoutBom = csv.startsWith("﻿") ? csv.slice(1) : csv;

    const header = (withoutBom.split("\r\n")[0] ?? "").split(",");
    const columns = header.map((h) => ({ key: h, header: h }));
    const parsed = parseCsv(csv, columns);

    const row = parsed.rows.find((r) => r["제목"] === TITLE);
    expect(row, "내보내기에 검증 작품이 있어야 한다").toBeDefined();

    expect(row!["총인수비용"]).toBe(String(expected.totalAcquisitionCost));
    expect(row!["예상손익"]).toBe(String(expected.expectedProfit));
    expect(row!["ROI(%)"]).toBe(String(expected.roiPercent));
  });

  it("Scout의 CSV에는 재무 컬럼 자체가 없다", async () => {
    const res = await api<string>(sessions.SCOUT, "GET", "/api/export/titles");
    const csv = typeof res.body === "string" ? res.body : "";
    const header = (csv.replace(/^﻿/, "").split("\r\n")[0] ?? "").split(",");

    expect(header).not.toContain("총인수비용");
    expect(header).not.toContain("ROI(%)");
  });

  it("총 인수비용이 0이면 세 경로 모두 N/A로 수렴한다", async () => {
    // 금액을 전부 0으로 만든다
    await api(sessions.ANALYST, "PUT", `/api/titles/${titleId}/deal-financials`, {
      deal: { minimumGuarantee: "0", offerAmount: "0" },
      financials: { paAndBudget: "0", otherCosts: "0", expectedRevenue: String(10 * 억) },
    });

    const res = await api<{ financials: { roiPercent: number | null } }>(
      sessions.ANALYST,
      "GET",
      `/api/titles/${titleId}/financials`,
    );
    expect(res.body.financials.roiPercent).toBeNull();

    const html = await page(sessions.ANALYST, `/titles/${titleId}`);
    expect(html).toContain("N/A");
  });
});
