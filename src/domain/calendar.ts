/**
 * 달력일 인덱스 — D2(체류 일수)와 D3(D-day)가 공유하는 기반 개념.
 *
 * ⚠️ 이 디렉터리(src/domain)는 아무것도 import 하지 않는다.
 *    프레임워크·DB·HTTP·Prisma 타입에 의존하지 않으며 현재 시각도 인자로 받는다.
 *    이것이 속성 기반 테스트를 가능하게 하는 조건이다.
 *
 * 설계 근거: business-logic-model.md 1절
 */

const MS_PER_DAY = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Asia/Seoul 기준으로 해당 순간이 속한 날짜의, 에포크로부터의 일 수.
 * 시각(시·분·초)은 결과에 영향을 주지 않는다.
 *
 * 이 정의 하나가 D2·D3의 8개 속성을 성립시킨다:
 *  - 구간 경계를 공유하므로 차분의 합이 정확히 망원 급수로 상쇄된다
 *    (d₁−d₀) + (d₂−d₁) + … + (dₙ−dₙ₋₁) = dₙ − d₀
 *  - 정수 인덱스의 차이이므로 서머타임·윤초·시각 차이의 영향을 받지 않는다
 *
 * 만약 "시각 차이 ÷ 24시간 후 내림"으로 계산하면 구간마다 버려지는 나머지가
 * 쌓여 총합이 어긋난다. 그래서 이 방식이 아니다.
 */
export function dayIndex(instant: Date): number {
  return Math.floor((instant.getTime() + KST_OFFSET_MS) / MS_PER_DAY);
}

/** Asia/Seoul 기준 YYYY-MM-DD 표기 (BR-U1-020) */
export function formatDate(instant: Date): string {
  const shifted = new Date(instant.getTime() + KST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** KRW 표기 — 천 단위 구분 기호 + "원" (BR-U1-019) */
export function formatKrw(amount: bigint | string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const value = typeof amount === "bigint" ? amount : BigInt(amount);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}원`;
}
