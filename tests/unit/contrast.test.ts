/**
 * NFR-009 — WCAG AA 명도 대비 검증.
 *
 * **globals.css를 직접 파싱합니다.** 팔레트 값을 테스트에 복제하면 소스가 바뀔 때
 * 테스트는 옛 값을 검사하며 통과해, 아무것도 지키지 못하는 테스트가 됩니다.
 *
 * 기준: 일반 텍스트 4.5:1 · 큰 텍스트와 UI 컴포넌트 3:1
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyContrast, contrastRatio, roundRatio } from "@/domain/color-contrast";

const CSS = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");

/**
 * 지정한 셀렉터 블록에서 커스텀 프로퍼티를 뽑는다.
 * globals.css는 :root(라이트)와 :root[data-theme="dark"] 두 벌을 정의한다.
 *
 * 다크가 미디어 쿼리가 아닌 이유는 globals.css 주석 참조 — 인라인 스크립트가
 * 첫 페인트 전에 data-theme을 확정하므로 정의를 한 벌만 둔다.
 */
function extractTokens(blockStart: string): Record<string, string> {
  const idx = CSS.indexOf(blockStart);
  if (idx === -1) throw new Error(`블록을 찾을 수 없습니다: ${blockStart}`);

  // 블록 시작부터 첫 닫는 중괄호까지
  const from = CSS.indexOf("{", idx);
  const to = CSS.indexOf("}", from);
  const body = CSS.slice(from, to);

  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[m[1]!] = m[2]!;
  }
  return tokens;
}

const light = extractTokens(":root {");
const dark = extractTokens(':root[data-theme="dark"]');

interface Pair {
  label: string;
  fg: string;
  bg: string;
  /** 일반 텍스트 4.5 · 큰 텍스트와 UI 요소 3 */
  min: number;
}

function pairsFor(t: Record<string, string>): Pair[] {
  return [
    // 본문 텍스트
    { label: "본문(ink) / 페이지 배경", fg: t.ink!, bg: t.ground!, min: 4.5 },
    { label: "본문(ink) / 카드", fg: t.ink!, bg: t.surface!, min: 4.5 },
    { label: "본문(ink) / 보조 배경", fg: t.ink!, bg: t["surface-2"]!, min: 4.5 },
    { label: "부제(ink-2) / 카드", fg: t["ink-2"]!, bg: t.surface!, min: 4.5 },
    { label: "설명(muted) / 카드", fg: t.muted!, bg: t.surface!, min: 4.5 },
    { label: "설명(muted) / 페이지 배경", fg: t.muted!, bg: t.ground!, min: 4.5 },
    // 라벨 — .lbl은 10.5px이므로 '큰 텍스트'가 아니다. 일반 기준을 적용한다.
    { label: "라벨(faint) / 카드", fg: t.faint!, bg: t.surface!, min: 4.5 },
    // 액센트
    { label: "액센트 / 카드", fg: t.accent!, bg: t.surface!, min: 4.5 },
    { label: "액센트 / 액센트 배경(알약)", fg: t.accent!, bg: t["accent-soft"]!, min: 4.5 },
    { label: "버튼 글자 / 액센트 배경", fg: t["accent-ink"]!, bg: t.accent!, min: 4.5 },
    // 의미색 — 알약 배경 위와 카드 위 모두에서 쓰인다
    { label: "성공 / 성공 배경", fg: t.good!, bg: t["good-soft"]!, min: 4.5 },
    { label: "성공 / 카드", fg: t.good!, bg: t.surface!, min: 4.5 },
    { label: "경고 / 경고 배경", fg: t.warn!, bg: t["warn-soft"]!, min: 4.5 },
    { label: "위험 / 위험 배경", fg: t.crit!, bg: t["crit-soft"]!, min: 4.5 },
    { label: "위험 / 카드", fg: t.crit!, bg: t.surface!, min: 4.5 },
    // UI 경계 (WCAG 1.4.11) — 3:1
    //
    // 카드 테두리(--line)는 대상이 아니다. 1.4.11은 "컴포넌트를 식별하는 데 **필요한**"
    // 시각 정보에 적용되는데, 카드는 내용과 여백으로 식별되며 테두리는 장식이다.
    // 반면 입력 요소의 테두리는 "어디에 입력하는가"를 알려주는 필수 정보다.
    { label: "입력 테두리(line-strong) / 카드", fg: t["line-strong"]!, bg: t.surface!, min: 3 },
    { label: "입력 테두리 / 입력 배경", fg: t["line-strong"]!, bg: t["surface-2"]!, min: 3 },
  ];
}

function report(theme: string, pairs: Pair[]): string {
  return pairs
    .map((p) => {
      const r = roundRatio(contrastRatio(p.fg, p.bg));
      const ok = r >= p.min ? "✅" : "❌";
      return `  ${ok} ${p.label.padEnd(28)} ${String(r).padStart(6)}:1 (기준 ${p.min})  ${classifyContrast(r)}`;
    })
    .join("\n");
}

describe("색상 대비 계산", () => {
  it("WCAG 기준값과 맞는다", () => {
    // 검은색과 흰색은 21:1
    expect(roundRatio(contrastRatio("#000000", "#ffffff"))).toBe(21);
    // 같은 색은 1:1
    expect(roundRatio(contrastRatio("#7a2f63", "#7a2f63"))).toBe(1);
    // 순서를 바꿔도 같다
    expect(contrastRatio("#123456", "#abcdef")).toBeCloseTo(
      contrastRatio("#abcdef", "#123456"),
      10,
    );
  });

  it("3자리·6자리·8자리 hex를 모두 받는다", () => {
    expect(roundRatio(contrastRatio("#fff", "#000"))).toBe(21);
    expect(roundRatio(contrastRatio("#ffffff", "#000000"))).toBe(21);
    expect(roundRatio(contrastRatio("#ffffffff", "#000000ff"))).toBe(21);
  });
});

describe("NFR-009 — 라이트 테마 대비", () => {
  const pairs = pairsFor(light);

  it("팔레트가 파싱되었다", () => {
    expect(Object.keys(light).length).toBeGreaterThan(15);
  });

  for (const p of pairs) {
    it(`${p.label} ≥ ${p.min}:1`, () => {
      const ratio = roundRatio(contrastRatio(p.fg, p.bg));
      expect(ratio, `${p.fg} on ${p.bg}\n${report("라이트", pairs)}`).toBeGreaterThanOrEqual(
        p.min,
      );
    });
  }
});

describe("NFR-009 — 다크 테마 대비", () => {
  const pairs = pairsFor(dark);

  it("팔레트가 파싱되었다", () => {
    expect(Object.keys(dark).length).toBeGreaterThan(15);
  });

  for (const p of pairs) {
    it(`${p.label} ≥ ${p.min}:1`, () => {
      const ratio = roundRatio(contrastRatio(p.fg, p.bg));
      expect(ratio, `${p.fg} on ${p.bg}\n${report("다크", pairs)}`).toBeGreaterThanOrEqual(
        p.min,
      );
    });
  }
});
