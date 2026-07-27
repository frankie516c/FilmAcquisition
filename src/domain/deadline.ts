/**
 * D3 — 마감 D-day 계산과 상태 판정.
 *
 * ⚠️ import 금지 구역 — calendar.ts(공통 원시)만 참조한다. dwell-time.ts 헤더 주석 참조.
 * 설계 근거: business-logic-model.md 4절
 */

import { dayIndex } from "./calendar";

export type DeadlineStatus = "expired" | "imminent" | "upcoming" | "out-of-range";
export type DeadlineRange = 7 | 30 | 90;

/** 오퍼 만료 알림 임계값 (US-024) */
export const OFFER_THRESHOLDS: readonly number[] = [7, 1];
/** 판권 만료 알림 임계값 (US-024) */
export const RIGHTS_THRESHOLDS: readonly number[] = [30, 7];

/**
 * D-day. Asia/Seoul 달력일 경계로 계산하므로 시각(시·분·초)은 영향을 주지 않는다.
 *
 *  0  → 오늘 만료 (D-0)
 *  n  → n일 남음
 * -n  → n일 전에 만료됨
 */
export function calculateDDay(baseDate: Date, targetDate: Date): number {
  return dayIndex(targetDate) - dayIndex(baseDate);
}

export function classifyDeadline(dDay: number, rangeDays: DeadlineRange): DeadlineStatus {
  if (dDay < 0) return "expired";
  if (dDay <= 7) return "imminent";
  if (dDay <= rangeDays) return "upcoming";
  return "out-of-range";
}

/**
 * 알림을 생성해야 하는 시점인지 판정한다.
 *
 * 임계값과 "정확히 일치"할 때만 참이다. 범위 조건(dDay <= 7)이면
 * D-7부터 D-0까지 매일 알림이 생성된다. 알림 중복 방지 키가 "D-7" 같은
 * 임계값 문자열이므로, 정확 일치가 "임계값 하나당 알림 하나"를 보장한다.
 */
export function shouldNotify(dDay: number, thresholds: readonly number[]): boolean {
  return thresholds.includes(dDay);
}

/** 알림 중복 방지 키 (Notification.marker) */
export function deadlineMarker(dDay: number): string {
  return `D-${dDay}`;
}
