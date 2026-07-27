/**
 * C1 AuthComponent — 로그인·세션·사용자 계정 관리.
 *
 * 설계 근거: services.md (S1 AuthService, S2 UserManagementService),
 *            business-rules.md 1~2절, business-logic-model.md 7절
 */

import { getDummyHash, hashPassword, verifyPassword } from "@/platform/password";
import { prisma, runInTransaction, type Tx } from "@/platform/db";
import { SESSION_TTL_HOURS, requireRole, type Ctx } from "@/platform/context";
import { AuthenticationError, ConflictError, NotFoundError } from "@/platform/errors";
import type { Role } from "@/platform/authz/policy";

export interface SessionResult {
  sessionId: string;
  expiresAt: Date;
  user: { id: string; name: string; email: string; role: Role };
}

export async function login(email: string, password: string): Promise<SessionResult> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    // 계정이 없어도 검증 연산을 수행해 응답 시간 차이를 없앤다 (BR-U1-002)
    await verifyPassword(await getDummyHash(), password);
    throw new AuthenticationError();
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw new AuthenticationError();

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });

  return {
    sessionId: session.id,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
  };
}

export async function logout(sessionId: string): Promise<void> {
  // 쿠키만 지우고 서버 세션을 남기지 않는다 (BR-U1-006)
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function listUsers(ctx: Ctx) {
  requireRole(ctx, "EXECUTIVE");
  return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

export interface NewUserInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

export async function createUser(ctx: Ctx, input: NewUserInput) {
  requireRole(ctx, "EXECUTIVE");

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("이미 사용 중인 이메일입니다.");

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
  });
}

/**
 * 트랜잭션 T6 — "Executive 수 조회 → 변경"을 하나의 트랜잭션으로 묶는다.
 *
 * 묶지 않으면 두 Executive가 동시에 서로를 강등할 때 각 트랜잭션이
 * "2명이니 괜찮다"고 판단해 둘 다 성공하고 Executive가 0명이 된다.
 */
export async function changeRole(ctx: Ctx, userId: string, role: Role) {
  requireRole(ctx, "EXECUTIVE");

  return runInTransaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundError("사용자를 찾을 수 없습니다.");

    if (target.role === "EXECUTIVE" && role !== "EXECUTIVE") {
      await assertNotLastExecutive(tx);
    }
    return tx.user.update({ where: { id: userId }, data: { role } });
  });
}

export async function deleteUser(ctx: Ctx, userId: string): Promise<void> {
  requireRole(ctx, "EXECUTIVE");

  await runInTransaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundError("사용자를 찾을 수 없습니다.");

    if (target.role === "EXECUTIVE") await assertNotLastExecutive(tx);

    // 세션은 Cascade로 함께 삭제된다.
    // 평가·코멘트·단계 이력은 SetNull로 보존된다 — 사용자 삭제로 이력이 사라지면
    // "체류 일수 총합 = 경과 일수" 속성이 깨지기 때문이다.
    await tx.user.delete({ where: { id: userId } });
  });
}

async function assertNotLastExecutive(tx: Tx): Promise<void> {
  const count = await tx.user.count({ where: { role: "EXECUTIVE" } });
  if (count <= 1) {
    throw new ConflictError("최소 1명의 경영진 계정이 필요합니다.", "LAST_EXECUTIVE");
  }
}

export { hashPassword } from "@/platform/password";
