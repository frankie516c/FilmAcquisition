/**
 * X5 — 요청 컨텍스트. 현재 사용자와 역할을 보관해 하위 계층에 전달한다.
 *
 * 서비스 메서드는 역할을 인자로 받지 않고 이 컨텍스트에서 읽는다.
 * 호출부가 역할을 위조해 전달할 수 없게 하기 위함이다 (설계 위반 판정 #6).
 *
 * 설계 근거: business-logic-model.md 7.2절
 */

import { cookies } from "next/headers";
import { AuthenticationError, ForbiddenError, SESSION_REQUIRED } from "@/platform/errors";
import { prisma } from "@/platform/db";
import type { Role } from "@/platform/authz/policy";

export const SESSION_COOKIE = "fad_session";
export const SESSION_TTL_HOURS = 12;

export interface Ctx {
  readonly userId: string;
  readonly role: Role;
  readonly userName: string;
  /**
   * 요청 시각. 순수 도메인 모듈이 전역 시각을 읽지 않고 인자로 받게 하기 위함이다.
   * 한 요청 안의 모든 계산이 동일한 시각을 쓰므로 결과가 일관된다.
   */
  readonly now: Date;
}

/**
 * 세션 쿠키에는 세션 ID만 담고 역할은 담지 않는다.
 * 매 요청마다 Session → User를 조회해 현재 역할을 읽으므로,
 * Executive가 역할을 바꾸면 다음 요청부터 즉시 반영된다 (US-028).
 */
export async function requireContext(): Promise<Ctx> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) throw new AuthenticationError(SESSION_REQUIRED);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session) throw new AuthenticationError(SESSION_REQUIRED);

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    throw new AuthenticationError(SESSION_REQUIRED);
  }
  if (!session.user) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    throw new AuthenticationError(SESSION_REQUIRED);
  }

  return {
    userId: session.user.id,
    role: session.user.role as Role,
    userName: session.user.name,
    now,
  };
}

/** 동작 권한 확인. 모든 변경 계열 서비스 메서드의 첫 문장에서 호출한다. */
export function requireRole(ctx: Ctx, ...allowed: Role[]): void {
  if (!allowed.includes(ctx.role)) {
    throw new ForbiddenError("이 작업을 수행할 권한이 없습니다.");
  }
}
