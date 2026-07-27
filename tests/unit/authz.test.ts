/**
 * X1 권한 정책 + X2 직렬화 게이트 단위 테스트.
 *
 * US-014·US-027의 핵심 수용 기준 — "값이 null인 것이 아니라 키 자체가 없다" — 를
 * 여기서 검증한다.
 */

import { describe, expect, it } from "vitest";
import { canPerform, canReadEntity, canReadField } from "@/platform/authz/policy";
import { serialize, serializeForExport } from "@/platform/authz/serialize";

const deal = {
  id: "d1",
  titleId: "t1",
  offerAmount: 900_000_000n,
  offerExpiryDate: new Date("2026-08-01T00:00:00Z"),
  askingPrice: 1_200_000_000n,
  minimumGuarantee: 800_000_000n,
  runningRoyaltyRate: 12.5,
  contractTerms: "극장 우선 개봉, 홀드백 4개월",
};

describe("X1 권한 정책", () => {
  it("정책에 등재되지 않은 필드는 차단이 기본값이다", () => {
    expect(canReadField("EXECUTIVE", "User", "passwordHash")).toBe(false);
    expect(canReadField("EXECUTIVE", "Deal", "someFieldAddedLater")).toBe(false);
    expect(canReadField("EXECUTIVE", "UnknownEntity", "anything")).toBe(false);
  });

  it("Scout는 오퍼 금액은 보되 MG·계약조건은 보지 못한다", () => {
    expect(canReadField("SCOUT", "Deal", "offerAmount")).toBe(true);
    expect(canReadField("SCOUT", "Deal", "offerExpiryDate")).toBe(true);
    expect(canReadField("SCOUT", "Deal", "minimumGuarantee")).toBe(false);
    expect(canReadField("SCOUT", "Deal", "runningRoyaltyRate")).toBe(false);
    expect(canReadField("SCOUT", "Deal", "contractTerms")).toBe(false);
    expect(canReadEntity("SCOUT", "FinancialModel")).toBe(false);
  });

  it("권한 매트릭스 12항목이 역할별로 정확히 구분된다", () => {
    expect(canPerform("SCOUT", "title:write")).toBe(true);
    expect(canPerform("ANALYST", "title:write")).toBe(false);
    expect(canPerform("EXECUTIVE", "pipeline:changeStage")).toBe(false);
    expect(canPerform("ANALYST", "deal:update")).toBe(true);
    expect(canPerform("SCOUT", "report:generate")).toBe(false);
    expect(canPerform("EXECUTIVE", "user:manage")).toBe(true);
  });
});

describe("X2 직렬화 게이트", () => {
  it("차단 필드는 키 자체가 응답에 없다 (null이 아니다)", () => {
    const scoutView = serialize("SCOUT", "Deal", deal) as Record<string, unknown>;

    expect("minimumGuarantee" in scoutView).toBe(false);
    expect("runningRoyaltyRate" in scoutView).toBe(false);
    expect("contractTerms" in scoutView).toBe(false);
    expect("askingPrice" in scoutView).toBe(false);

    // 오퍼 금액은 남는다
    expect(scoutView.offerAmount).toBe("900000000");
  });

  it("Analyst·Executive는 마스킹 없이 전 필드를 받는다", () => {
    for (const role of ["ANALYST", "EXECUTIVE"] as const) {
      const view = serialize(role, "Deal", deal) as Record<string, unknown>;
      expect("minimumGuarantee" in view).toBe(true);
      expect(view.minimumGuarantee).toBe("800000000");
      expect(view.contractTerms).toBe(deal.contractTerms);
    }
  });

  it("BigInt는 문자열로, Date는 ISO 문자열로 변환된다", () => {
    const view = serialize("ANALYST", "Deal", deal) as Record<string, unknown>;
    expect(typeof view.offerAmount).toBe("string");
    expect(typeof view.offerExpiryDate).toBe("string");
    // JSON.stringify가 예외를 던지지 않아야 한다
    expect(() => JSON.stringify(view)).not.toThrow();
  });

  it("엔티티 단위 차단은 관계 필드째로 제거한다 — 빈 객체를 남기지 않는다", () => {
    const title = {
      id: "t1",
      titleKo: "조용한 이주",
      financialModel: { paAndBudget: 100n, otherCosts: 0n, expectedRevenue: 500n },
    };
    const scoutView = serialize("SCOUT", "Title", title) as Record<string, unknown>;
    expect("financialModel" in scoutView).toBe(false);

    const analystView = serialize("ANALYST", "Title", title) as Record<string, unknown>;
    expect("financialModel" in analystView).toBe(true);
  });

  it("원시값 배열은 필드로 유지된다 — 미등록 관계로 오인해 지우지 않는다", () => {
    // 회귀 방지: genres·territories·cast가 응답에서 통째로 사라지던 결함
    const title = {
      id: "t1",
      titleKo: "조용한 이주",
      genres: ["DRAMA", "THRILLER"],
      cast: ["배우A", "배우B"],
    };
    const view = serialize("SCOUT", "Title", title) as Record<string, unknown>;

    expect(view.genres).toEqual(["DRAMA", "THRILLER"]);
    expect(view.cast).toEqual(["배우A", "배우B"]);
  });

  it("빈 배열도 필드로 유지된다", () => {
    const view = serialize("SCOUT", "Title", { id: "t1", genres: [] }) as Record<string, unknown>;
    expect(view.genres).toEqual([]);
  });

  it("객체 배열은 RELATION_MAP에 없으면 여전히 차단된다", () => {
    const title = {
      id: "t1",
      // RELATION_MAP에 등록되지 않은 관계 — 검증되지 않은 채 노출되면 안 된다
      unregisteredRelation: [{ secret: "노출되면 안 됨" }],
    };
    const view = serialize("SCOUT", "Title", title) as Record<string, unknown>;
    expect("unregisteredRelation" in view).toBe(false);
  });

  it("내보내기는 차단 필드를 컬럼 목록에서도 제거한다", () => {
    const columns = [
      { key: "offerAmount", header: "오퍼 금액" },
      { key: "minimumGuarantee", header: "MG" },
    ];
    const scout = serializeForExport("SCOUT", "Deal", [deal], columns);
    expect(scout.columns.map((c) => c.key)).toEqual(["offerAmount"]);

    const analyst = serializeForExport("ANALYST", "Deal", [deal], columns);
    expect(analyst.columns.map((c) => c.key)).toEqual(["offerAmount", "minimumGuarantee"]);
  });
});
