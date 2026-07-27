/**
 * S8 — CSV 가져오기 2단계 (미리보기 → 반영)
 *
 * 미리보기가 아무것도 저장하지 않는 것과, 오류 행이 있을 때의 두 모드 동작을 검증합니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, type Role, type Session } from "./helpers";

const BASE = process.env.FAD_BASE_URL || "http://localhost:3100";
const BOM = "﻿";
const PREFIX = "[통합테스트] 수입";

let sessions: Record<Role, Session>;
const createdIds: string[] = [];

interface Preview {
  totalRows: number;
  validCount: number;
  issues: { rowNumber: number; column: string; message: string }[];
  sample: { titleKo: string }[];
}

/** 정상 2행 + 오류 3행 */
function mixedCsv(): string {
  return (
    BOM +
    [
      "제목,원제,감독,제작연도,장르,시놉시스",
      `${PREFIX} A,Import A,김감독,2025,드라마;스릴러,"쉼표, 따옴표"" 포함"`,
      `${PREFIX} B,Import B,이감독,2024,코미디,정상 행`,
      ",Missing Title,박감독,2025,액션,제목이 비어 있음",
      "연도오류,Bad Year,최감독,1800,드라마,연도 범위 초과",
      "장르오류,Bad Genre,정감독,2025,없는장르,알 수 없는 장르",
    ].join("\r\n") +
    "\r\n"
  );
}

async function upload(session: Session, csv: string, mode?: "ALL" | "VALID_ONLY") {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "test.csv");
  if (mode) form.append("mode", mode);

  const res = await fetch(`${BASE}/api/import/titles`, {
    method: "POST",
    headers: { cookie: session.cookie },
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

async function countTitles(session: Session): Promise<number> {
  const res = await api<string>(session, "GET", "/api/export/titles");
  return Number(res.headers.get("x-row-count"));
}

beforeAll(async () => {
  sessions = await loginAll();
}, 60_000);

afterAll(async () => {
  for (const id of createdIds) await deleteTitle(sessions.SCOUT, id);
});

describe("S8 CSV 가져오기", () => {
  it("Executive는 가져오기 권한이 없다", async () => {
    const res = await upload(sessions.EXECUTIVE, mixedCsv());
    expect(res.status).toBe(403);
  });

  it("미리보기는 오류를 행 번호·컬럼·사유로 보고한다", async () => {
    const res = await upload(sessions.SCOUT, mixedCsv());
    expect(res.status).toBe(200);

    const p = res.body as Preview;
    expect(p.totalRows).toBe(5);
    expect(p.validCount).toBe(2);
    expect(p.issues).toHaveLength(3);

    // 행 번호는 1-based이며 헤더가 1행이므로 데이터 첫 행은 2다
    expect(p.issues.map((i) => i.rowNumber).sort()).toEqual([4, 5, 6]);
    expect(p.issues.some((i) => i.message.includes("제목"))).toBe(true);
    expect(p.issues.some((i) => i.message.includes("1888"))).toBe(true);
    expect(p.issues.some((i) => i.message.includes("알 수 없는 장르"))).toBe(true);
  });

  it("미리보기는 아무것도 저장하지 않는다", async () => {
    const before = await countTitles(sessions.SCOUT);
    await upload(sessions.SCOUT, mixedCsv());
    const after = await countTitles(sessions.SCOUT);

    expect(after).toBe(before);
  });

  it("쉼표·따옴표가 든 값이 정확히 파싱된다", async () => {
    const res = await upload(sessions.SCOUT, mixedCsv());
    const p = res.body as Preview;

    expect(p.sample[0]?.titleKo).toBe(`${PREFIX} A`);
    // 시놉시스의 인용 처리가 깨졌다면 필드 수가 어긋나 오류 행이 되었을 것이다
    expect(p.validCount).toBe(2);
  });

  it("전체 반영은 오류 행이 있으면 거부된다", async () => {
    const before = await countTitles(sessions.SCOUT);
    const res = await upload(sessions.SCOUT, mixedCsv(), "ALL");

    expect(res.status).toBe(400);
    expect((res.body as { error: { message: string } }).error.message).toContain("정상 행만 반영");

    const after = await countTitles(sessions.SCOUT);
    expect(after).toBe(before); // 하나도 들어가지 않았다
  });

  it("정상 행만 반영하면 유효한 행만 들어간다 (T5)", async () => {
    const before = await countTitles(sessions.SCOUT);
    const res = await upload(sessions.SCOUT, mixedCsv(), "VALID_ONLY");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imported: 2, skipped: 3 });

    const after = await countTitles(sessions.SCOUT);
    expect(after).toBe(before + 2);

    // 정리를 위해 방금 만든 작품의 id를 찾는다
    const csv = await api<string>(sessions.SCOUT, "GET", "/api/export/titles");
    expect(typeof csv.body === "string" && csv.body.includes(`${PREFIX} A`)).toBe(true);

    const list = await fetch(`${BASE}/titles?q=${encodeURIComponent(PREFIX)}`, {
      headers: { cookie: sessions.SCOUT.cookie },
    });
    const html = await list.text();
    for (const m of html.matchAll(/\/titles\/([a-z0-9]{20,})/g)) {
      if (!createdIds.includes(m[1]!)) createdIds.push(m[1]!);
    }
    expect(createdIds.length).toBeGreaterThanOrEqual(2);
  });

  it("가져온 작품에도 최초 이력이 남고 사유가 표시된다 (T3와 동일)", async () => {
    const id = createdIds[0]!;
    const res = await fetch(`${BASE}/titles/${id}`, {
      headers: { cookie: sessions.SCOUT.cookie },
    });
    const html = await res.text();

    // US-008 — 이력에 변경자와 사유 메모가 표시되어야 한다
    expect(html).toContain("CSV 가져오기"); // 최초 이력의 note
    expect(html).toContain(sessions.SCOUT.name); // 변경자
    expect(html).toContain("발굴");
    expect(html).toContain("일치"); // 체류 일수 불변식
    expect(html).not.toContain("불일치");
  });
});
