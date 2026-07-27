/**
 * 알림 중복 판정 키 생성 — 순수 함수.
 *
 * ⚠️ import 금지 구역.
 *
 * ## 왜 별도 키가 필요한가
 *
 * 초기 설계는 `@@unique([userId, type, titleId, marker])` 였다. 그런데 PostgreSQL에서
 * `NULL`은 서로 같지 않으므로, `titleId`가 `NULL`인 행은 **UNIQUE 제약이 걸리지 않는다.**
 * 같은 (userId, type, marker) 조합이라도 무제한으로 삽입된다.
 *
 * 현재는 모든 알림에 `titleId`가 있어 증상이 없지만, 작품과 무관한 알림(시스템 공지 등)이
 * 추가되는 순간 중복 방지가 조용히 무력화된다. 발현되기 전에 막는다.
 *
 * 해결: 중복 판정의 근거를 **NOT NULL 단일 컬럼**으로 명시한다.
 * 네 컬럼의 암묵적 조합이 아니라 하나의 값이 "이 알림의 정체성"을 나타낸다.
 */

export type NotificationKind = "MENTION" | "OFFER_EXPIRY" | "RIGHTS_EXPIRY" | "SYSTEM";

/** 작품이 없는 알림의 자리표시자. 빈 문자열이 아니라 명시적 기호를 쓴다. */
const NO_SUBJECT = "-";

/**
 * 멘션 알림 — 코멘트 하나당 알림 하나.
 * 같은 코멘트가 같은 사람을 여러 번 언급해도 알림은 1건이다.
 */
export function mentionKey(commentId: string): string {
  return `mention:${commentId}`;
}

/**
 * 마감 알림 — 임계값 하나당 알림 하나.
 *
 * 임계값이 키에 들어가므로 D-7과 D-1은 서로 다른 알림이고,
 * 같은 D-7은 몇 번을 스캔해도 하나다.
 */
export function deadlineKey(
  kind: "OFFER_EXPIRY" | "RIGHTS_EXPIRY",
  subjectId: string | null | undefined,
  threshold: number,
): string {
  return `${kind.toLowerCase()}:${subjectId ?? NO_SUBJECT}:D-${threshold}`;
}

/**
 * 작품과 무관한 시스템 알림 — 현재 쓰이지 않지만 키 체계가 이를 수용한다.
 * `titleId`가 없어도 키는 NOT NULL이므로 중복 방지가 정상 작동한다.
 */
export function systemKey(topic: string): string {
  return `system:${NO_SUBJECT}:${topic}`;
}
