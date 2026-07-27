/**
 * 알림 중복 판정 키 — 순수 함수 검증.
 *
 * 이 키가 존재하는 이유는 PostgreSQL의 NULL 비교 규칙 때문입니다.
 * `@@unique([userId, type, titleId, marker])` 에서 titleId가 NULL이면
 * NULL != NULL 이므로 제약이 걸리지 않습니다.
 */

import { describe, expect, it } from "vitest";
import { deadlineKey, mentionKey, systemKey } from "@/domain/notification-key";

describe("알림 중복 판정 키", () => {
  it("멘션은 코멘트 하나당 하나의 키를 만든다", () => {
    expect(mentionKey("cms123")).toBe("mention:cms123");
    // 같은 코멘트는 몇 번을 처리해도 같은 키
    expect(mentionKey("cms123")).toBe(mentionKey("cms123"));
  });

  it("서로 다른 코멘트는 서로 다른 키를 만든다", () => {
    expect(mentionKey("a")).not.toBe(mentionKey("b"));
  });

  it("마감 알림은 임계값마다 다른 키를 만든다", () => {
    const d7 = deadlineKey("OFFER_EXPIRY", "t1", 7);
    const d1 = deadlineKey("OFFER_EXPIRY", "t1", 1);

    expect(d7).toBe("offer_expiry:t1:D-7");
    expect(d1).toBe("offer_expiry:t1:D-1");
    expect(d7).not.toBe(d1);
  });

  it("같은 임계값·같은 작품이면 항상 같은 키다 — 재실행해도 중복이 생기지 않는다", () => {
    expect(deadlineKey("OFFER_EXPIRY", "t1", 7)).toBe(deadlineKey("OFFER_EXPIRY", "t1", 7));
  });

  it("오퍼 만료와 판권 만료는 같은 작품·같은 임계값이라도 다른 키다", () => {
    expect(deadlineKey("OFFER_EXPIRY", "t1", 7)).not.toBe(
      deadlineKey("RIGHTS_EXPIRY", "t1", 7),
    );
  });

  it("★ 작품이 없어도 키가 만들어진다 — 이것이 이 설계의 이유다", () => {
    // 이전 설계에서는 titleId가 NULL이면 UNIQUE 제약이 무력화됐다.
    // 키는 NOT NULL이므로 그런 구멍이 없다.
    const a = deadlineKey("OFFER_EXPIRY", null, 7);
    const b = deadlineKey("OFFER_EXPIRY", undefined, 7);

    expect(a).toBe("offer_expiry:-:D-7");
    expect(a).toBe(b); // null과 undefined가 같은 키로 수렴해야 중복이 막힌다
    expect(a).not.toContain("null");
    expect(a).not.toContain("undefined");
  });

  it("작품 없는 알림끼리도 임계값이 다르면 구분된다", () => {
    expect(deadlineKey("OFFER_EXPIRY", null, 7)).not.toBe(
      deadlineKey("OFFER_EXPIRY", null, 1),
    );
  });

  it("시스템 알림도 같은 체계를 따른다", () => {
    expect(systemKey("maintenance")).toBe("system:-:maintenance");
    expect(systemKey("maintenance")).not.toBe(systemKey("release"));
  });

  it("어떤 입력에도 키가 빈 문자열이 되지 않는다", () => {
    // 빈 키는 모든 알림을 하나로 뭉쳐 중복 방지가 과하게 작동한다
    expect(mentionKey("")).not.toBe("");
    expect(deadlineKey("OFFER_EXPIRY", "", 0)).not.toBe("");
    expect(systemKey("")).not.toBe("");
  });
});
