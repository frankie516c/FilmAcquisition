/**
 * S2 — 내보내기도 화면과 같은 마스킹을 따르는가
 *
 * 화면과 파일이 다른 규칙을 쓰면 마스킹이 무의미해집니다.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { api, loginAll, rawBytes, type Role, type Session } from "./helpers";
import { parseCsv } from "@/domain/csv";

let sessions: Record<Role, Session>;

const SCOUT_VISIBLE = ["제목", "원제", "감독", "제작연도", "단계", "담당자", "종합점수", "오퍼금액", "오퍼만료일"];
const SCOUT_HIDDEN = ["요청가", "MG", "러닝로열티율", "계약조건", "예상매출", "총인수비용", "예상손익", "ROI(%)"];

beforeAll(async () => {
  sessions = await loginAll();
}, 60_000);

async function exportCsv(session: Session) {
  const res = await api<string>(session, "GET", "/api/export/titles");
  return {
    status: res.status,
    csv: typeof res.body === "string" ? res.body : "",
    omitted: decodeURIComponent(res.headers.get("x-omitted-columns") ?? ""),
    rowCount: res.headers.get("x-row-count"),
  };
}

function headerOf(csv: string): string[] {
  const withoutBom = csv.startsWith("﻿") ? csv.slice(1) : csv;
  return (withoutBom.split("\r\n")[0] ?? "").split(",");
}

describe("S2 내보내기 마스킹", () => {
  it("Scout 파일에는 금액·재무 컬럼이 없다", async () => {
    const { status, csv, omitted } = await exportCsv(sessions.SCOUT);
    expect(status).toBe(200);

    const header = headerOf(csv);
    for (const col of SCOUT_VISIBLE) expect(header).toContain(col);
    for (const col of SCOUT_HIDDEN) expect(header).not.toContain(col);

    // 제외된 컬럼을 사용자에게 알려야 한다
    for (const col of SCOUT_HIDDEN) expect(omitted).toContain(col);
  });

  it("Analyst 파일에는 전 컬럼이 있고 제외 안내가 비어 있다", async () => {
    const { status, csv, omitted } = await exportCsv(sessions.ANALYST);
    expect(status).toBe(200);

    const header = headerOf(csv);
    for (const col of [...SCOUT_VISIBLE, ...SCOUT_HIDDEN]) expect(header).toContain(col);
    expect(omitted).toBe("");
  });

  it("Executive는 내보내기 권한이 없다", async () => {
    const res = await api(sessions.EXECUTIVE, "GET", "/api/export/titles");
    expect(res.status).toBe(403);
  });

  it("두 역할의 행 수는 같고 컬럼 수만 다르다", async () => {
    const scout = await exportCsv(sessions.SCOUT);
    const analyst = await exportCsv(sessions.ANALYST);

    expect(scout.rowCount).toBe(analyst.rowCount);
    expect(headerOf(scout.csv).length).toBeLessThan(headerOf(analyst.csv).length);
  });

  it("응답 바이트가 UTF-8 BOM으로 시작한다 — Excel의 한글 깨짐 방지", async () => {
    // text()는 선두 BOM을 제거하므로 바이트로 확인해야 한다.
    // 문자열로 검사하면 BOM이 없어도 통과하거나, 있어도 실패한다.
    const bytes = await rawBytes(sessions.ANALYST, "/api/export/titles");
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("쉼표가 든 값이 RFC 4180대로 인용되어 파싱된다", async () => {
    const { csv } = await exportCsv(sessions.ANALYST);
    const columns = headerOf(csv).map((h) => ({ key: h, header: h }));
    const parsed = parseCsv(csv, columns);

    expect(parsed.errors).toHaveLength(0);
    // 계약조건에 쉼표가 든 행이 시드에 있다 — 인용이 깨졌다면 필드 수가 어긋나 오류가 난다
    expect(parsed.rows.length).toBeGreaterThan(0);
  });

  it("단계 필터가 내보내기 범위에 반영된다", async () => {
    const all = await api<string>(sessions.ANALYST, "GET", "/api/export/titles");
    const filtered = await api<string>(
      sessions.ANALYST,
      "GET",
      "/api/export/titles?stage=CLOSED_WON",
    );

    const allRows = Number(all.headers.get("x-row-count"));
    const filteredRows = Number(filtered.headers.get("x-row-count"));

    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThan(allRows);
  });
});
