/**
 * WCAG 2.1 명도 대비 계산 — 순수 함수.
 *
 * ⚠️ import 금지 구역.
 *
 * NFR-009: "텍스트 대비는 WCAG AA(4.5:1) 이상을 목표로 한다"
 *
 * 기준 (WCAG 2.1 SC 1.4.3 / 1.4.11)
 *   일반 텍스트          4.5:1
 *   큰 텍스트(18.66px+ bold 또는 24px+)  3:1
 *   UI 컴포넌트·그래픽 경계              3:1
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` `#rrggbb` `#rrggbbaa` 를 받는다. 알파는 무시한다(배경 합성은 별도 문제). */
export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");

  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(expanded)) {
    throw new Error(`색상 형식을 해석할 수 없습니다: ${hex}`);
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/** sRGB 채널을 선형 값으로 되돌린다 (감마 보정 해제) */
function linearize(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 상대 휘도 (WCAG 정의) */
export function relativeLuminance(color: Rgb | string): number {
  const { r, g, b } = typeof color === "string" ? parseHex(color) : color;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * 명도 대비. 1(동일) ~ 21(흑백) 사이의 값.
 * 인자 순서는 결과에 영향을 주지 않는다.
 */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = "AAA" | "AA" | "AA-large" | "fail";

/** 소수 둘째 자리까지 버림 — 기준을 아슬아슬하게 통과하는 것을 과대평가하지 않는다 */
export function roundRatio(ratio: number): number {
  return Math.floor(ratio * 100) / 100;
}

export function classifyContrast(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}
