/**
 * S4 — 단계 전환과 이력 무결성
 *
 * 이력이 누락되면 "체류 일수 총합 = 등록 후 경과 일수" 속성이 깨집니다.
 * 이 테스트는 자기가 만든 작품으로만 검증하고 정리하므로 시드 데이터를 건드리지 않습니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, page, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;
let titleId: string;

beforeAll(async () => {
  sessions = await loginAll();

  const res = await api<{ title: { id: string } }>(sessions.SCOUT, "POST", "/api/titles", {
    titleKo: "[통합테스트] 파이프라인 검증작",
    titleOriginal: "Integration Pipeline Fixture",
    productionYear: 2025,
    genres: ["DRAMA"],
  });
  expect(res.status).toBe(201);
  titleId = res.body.title.id;
}, 60_000);

afterAll(async () => {
  if (titleId) await deleteTitle(sessions.SCOUT, titleId);
});

describe("S4 단계 전환과 이력", () => {
  it("생성 즉시 최초 이력이 1건 존재한다 (T3)", async () => {
    const html = await page(sessions.SCOUT, `/titles/${titleId}`);
    expect(html).toContain("발굴");
    expect(html).toContain("진행 중");
    // 체류 일수 총합과 경과 일수가 일치해야 한다
    expect(html).toContain("일치");
    expect(html).not.toContain("불일치");
  });

  it("Executive는 단계를 바꿀 수 없다", async () => {
    const res = await api(sessions.EXECUTIVE, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "SCREENING",
    });
    expect(res.status).toBe(403);
  });

  it("Scout·Analyst는 단계를 바꿀 수 있다", async () => {
    const a = await api(sessions.SCOUT, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "SCREENING",
    });
    expect(a.status).toBe(200);

    const b = await api(sessions.ANALYST, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "EVALUATION",
    });
    expect(b.status).toBe(200);
  });

  it("같은 단계로의 이동은 거부된다", async () => {
    const res = await api<{ error: { code: string } }>(
      sessions.SCOUT,
      "POST",
      `/api/pipeline/${titleId}/stage`,
      { toStage: "EVALUATION" },
    );
    expect(res.status).toBe(400);
  });

  it("단계 건너뛰기와 되돌리기가 모두 허용된다", async () => {
    // 평가 → 계약체결 (건너뛰기)
    const skip = await api(sessions.SCOUT, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "CLOSED_WON",
    });
    expect(skip.status).toBe(200);

    // 계약체결 → 스크리닝 (종료 상태에서 되돌리기)
    const back = await api(sessions.SCOUT, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "SCREENING",
    });
    expect(back.status).toBe(200);
  });

  it("전환을 반복해도 체류 일수 불변식이 유지된다", async () => {
    const html = await page(sessions.SCOUT, `/titles/${titleId}`);

    // 화면이 총합과 경과를 비교해 배지를 그린다
    expect(html).toContain("체류 일수 총합");
    expect(html).toContain("일치");
    expect(html).not.toContain("불일치");
  });

  it("이력에 변경자와 사유가 표시된다 (US-008)", async () => {
    // 사유를 남기며 단계를 옮긴다
    const res = await api(sessions.SCOUT, "POST", `/api/pipeline/${titleId}/stage`, {
      toStage: "OFFER",
      note: "통합테스트 사유 메모",
    });
    expect(res.status).toBe(200);

    const html = await page(sessions.SCOUT, `/titles/${titleId}`);
    expect(html).toContain("통합테스트 사유 메모");
    expect(html).toContain(sessions.SCOUT.name);
  });

  it("이력에 수정·삭제 수단이 없다", async () => {
    const html = await page(sessions.SCOUT, `/titles/${titleId}`);
    const historySection = html.slice(html.indexOf("단계 이력"), html.indexOf("단계 이력") + 3000);

    expect(historySection).toContain("append-only");
    expect(historySection).not.toContain("이력 삭제");
    expect(historySection).not.toContain("이력 수정");
  });

  it("칸반에 키보드 조작 경로가 있다 (NFR-009)", async () => {
    const scoutBoard = await page(sessions.SCOUT, "/board");
    const execBoard = await page(sessions.EXECUTIVE, "/board");

    // 변경 권한이 있으면 단계 선택 상자와 스크린 리더 라벨이 렌더된다
    expect(scoutBoard).toContain("<select");
    expect(scoutBoard).toContain("sr-only");
    expect(scoutBoard).toContain("단계 선택 상자를 키보드로");

    // 권한이 없으면 조작 수단 자체를 렌더하지 않는다
    expect(execBoard).not.toContain("<select");
  });
});
