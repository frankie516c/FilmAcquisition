/**
 * S10 — 쓰기 권한 매트릭스 (12항목 × 3역할)
 *
 * ## 이 테스트가 데이터를 만들지 않는 이유
 *
 * 허용된 역할까지 실제로 실행하면 매번 작품·딜·알림이 생겨 정리가 번거롭고,
 * 실패 시 잔여 데이터가 남습니다.
 *
 * 대신 이렇게 판정합니다:
 *   - 차단되어야 하는 역할 → **403이어야 한다** (데이터를 만들지 않으므로 안전)
 *   - 허용되어야 하는 역할 → **403이 아니어야 한다** (400·404여도 권한 게이트는 통과한 것)
 *
 * 실제 동작은 각 기능별 통합 테스트가 검증합니다. 여기서는 **권한 게이트만** 봅니다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, deleteTitle, loginAll, type Role, type Session } from "./helpers";

let sessions: Record<Role, Session>;
/** 존재하지 않는 ID — 권한을 통과하면 404가 나므로 데이터가 생기지 않는다 */
const GHOST = "ghost000000000000000000";

/**
 * 대부분의 케이스는 GHOST ID를 써서 404로 끝나므로 데이터를 만들지 않는다.
 * 예외는 '작품 등록' — 유효한 본문이어야 차단 역할에서 403이 나오므로(검증이 권한보다
 * 먼저 실행됨) 허용 역할에서는 실제로 생성된다. 생성분을 모아 정리한다.
 */
const createdTitleIds: string[] = [];

interface Case {
  action: string;
  method: string;
  path: string;
  body?: unknown;
  allowed: Role[];
}

const MATRIX: Case[] = [
  { action: "작품 등록", method: "POST", path: "/api/titles",
    body: { titleKo: "권한게이트확인", productionYear: 2025, genres: ["DRAMA"] },
    allowed: ["SCOUT"] },
  { action: "작품 수정", method: "PATCH", path: `/api/titles/${GHOST}`,
    body: { titleKo: "x" }, allowed: ["SCOUT"] },
  { action: "작품 삭제", method: "DELETE", path: `/api/titles/${GHOST}`,
    allowed: ["SCOUT"] },
  { action: "평가 등록", method: "POST", path: `/api/titles/${GHOST}/evaluations`,
    body: { artistry: 3, commerciality: 3, buzz: 3, targetFit: 3 },
    allowed: ["SCOUT"] },
  { action: "코멘트 작성", method: "POST", path: `/api/titles/${GHOST}/comments`,
    body: { body: "권한 게이트 확인" },
    allowed: ["SCOUT", "ANALYST", "EXECUTIVE"] },
  { action: "단계 변경", method: "POST", path: `/api/pipeline/${GHOST}/stage`,
    body: { toStage: "OFFER" }, allowed: ["SCOUT", "ANALYST"] },
  { action: "딜 수정", method: "PUT", path: `/api/titles/${GHOST}/deal`,
    body: { offerAmount: "1" }, allowed: ["ANALYST"] },
  { action: "딜·재무 통합 저장", method: "PUT", path: `/api/titles/${GHOST}/deal-financials`,
    body: { deal: { offerAmount: "1" } }, allowed: ["ANALYST"] },
  { action: "판권 등록", method: "POST", path: `/api/titles/${GHOST}/rights`,
    body: { territories: ["KR"], contractStartDate: "2026-01-01", contractEndDate: "2027-01-01" },
    allowed: ["ANALYST"] },
  { action: "재무 수정", method: "PUT", path: `/api/titles/${GHOST}/financials`,
    body: { paAndBudget: "1", otherCosts: "0", expectedRevenue: "2" },
    allowed: ["ANALYST"] },
  { action: "재무 조회", method: "GET", path: `/api/titles/${GHOST}/financials`,
    allowed: ["ANALYST", "EXECUTIVE"] },
  { action: "내보내기", method: "GET", path: "/api/export/titles",
    allowed: ["SCOUT", "ANALYST"] },
  { action: "리포트 생성", method: "GET", path: "/api/reports/pipeline",
    allowed: ["ANALYST", "EXECUTIVE"] },
  { action: "사용자 목록", method: "GET", path: "/api/users",
    allowed: ["EXECUTIVE"] },
  { action: "사용자 역할 변경", method: "PATCH", path: `/api/users/${GHOST}`,
    body: { role: "SCOUT" }, allowed: ["EXECUTIVE"] },
  { action: "사용자 삭제", method: "DELETE", path: `/api/users/${GHOST}`,
    allowed: ["EXECUTIVE"] },
];

const ALL_ROLES: Role[] = ["SCOUT", "ANALYST", "EXECUTIVE"];

beforeAll(async () => {
  sessions = await loginAll();
}, 60_000);

afterAll(async () => {
  for (const id of createdTitleIds) await deleteTitle(sessions.SCOUT, id);
});

describe("S10 쓰기 권한 매트릭스", () => {
  for (const c of MATRIX) {
    const denied = ALL_ROLES.filter((r) => !c.allowed.includes(r));

    if (denied.length > 0) {
      it(`${c.action} — ${denied.join("·")}는 403`, async () => {
        for (const role of denied) {
          const res = await api(sessions[role], c.method, c.path, c.body);
          expect(res.status, `${c.action} / ${role}`).toBe(403);
        }
      });
    }

    it(`${c.action} — ${c.allowed.join("·")}는 권한 게이트를 통과한다`, async () => {
      for (const role of c.allowed) {
        const res = await api<{ title?: { id: string } }>(
          sessions[role],
          c.method,
          c.path,
          c.body,
        );
        // 404·400은 권한을 통과한 뒤 나온 것이므로 게이트는 열린 것이다
        expect(res.status, `${c.action} / ${role}`).not.toBe(403);

        // 실제로 만들어진 작품이 있으면 정리 목록에 넣는다
        const id = (res.body as { title?: { id: string } } | undefined)?.title?.id;
        if (res.status === 201 && id) createdTitleIds.push(id);
      }
    });
  }
});
