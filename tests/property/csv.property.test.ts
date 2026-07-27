/**
 * D4 CSV 직렬화 — 속성 기반 테스트 4개.
 *
 * 문자 생성기에 쉼표·큰따옴표·CR·LF·한글·이모지를 명시적으로 포함시킨다.
 * 무작위 유니코드에만 의존하면 이 문자들이 거의 생성되지 않아 P2가 실질적으로
 * 검증되지 않는다.
 *
 * 설계 근거: business-logic-model.md 5.4절, 5.5절
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseCsv, serializeToCsv, type CsvColumn } from "@/domain/csv";

const RUNS = { numRuns: 100, seed: 20260725 };

const COLUMNS: CsvColumn[] = [
  { key: "titleKo", header: "제목" },
  { key: "director", header: "감독" },
  { key: "note", header: "비고" },
];

/** 왕복이 깨지기 쉬운 문자를 의도적으로 섞는다 */
const nastyChar = fc.constantFrom(
  ",", '"', "\r", "\n", "\r\n", "가", "나", "😀", " ", "a", "1", "'", ";", "\t",
);
const nastyString = fc.array(nastyChar, { minLength: 0, maxLength: 24 }).map((a) => a.join(""));

const row = fc.record({
  titleKo: nastyString,
  director: nastyString,
  note: nastyString,
});
const rows = fc.array(row, { minLength: 0, maxLength: 12 });

describe("D4 CsvSerializer", () => {
  it("P1·P2 — 왕복 무손실 (한글·쉼표·따옴표·줄바꿈 포함)", () => {
    fc.assert(
      fc.property(rows, (input) => {
        const csv = serializeToCsv(input, COLUMNS);
        const result = parseCsv(csv, COLUMNS);
        expect(result.errors).toHaveLength(0);
        expect(result.rows).toEqual(input);
      }),
      RUNS,
    );
  });

  it("P3 — 임의의 문자열 입력에 대해 예외를 던지지 않는다", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (garbage) => {
        expect(() => parseCsv(garbage, COLUMNS)).not.toThrow();
      }),
      RUNS,
    );
  });

  it("P4 — 첫 행은 항상 columns의 header 순서와 일치한다 (BOM 제거 후)", () => {
    fc.assert(
      fc.property(rows, (input) => {
        const csv = serializeToCsv(input, COLUMNS);
        const withoutBom = csv.startsWith("﻿") ? csv.slice(1) : csv;
        const firstLine = withoutBom.split("\r\n")[0];
        expect(firstLine).toBe(COLUMNS.map((c) => c.header).join(","));
      }),
      RUNS,
    );
  });

  it("BOM이 붙는다 — Excel의 한글 깨짐 방지", () => {
    // ⚠️ startsWith("﻿") 로 검사하면 안 된다.
    //    소스의 BOM 리터럴이 빈 문자열이 되어도 "abc".startsWith("") 가 true라
    //    BOM이 없는데도 통과한다. 코드 포인트를 직접 확인한다.
    expect(serializeToCsv([], COLUMNS).charCodeAt(0)).toBe(0xfeff);
  });

  it("헤더에 필수 컬럼이 없으면 MISSING_COLUMN 오류를 반환한다 (예외 아님)", () => {
    const result = parseCsv("제목,감독\r\n가,나", COLUMNS);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("MISSING_COLUMN");
  });
});
