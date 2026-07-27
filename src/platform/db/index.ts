/**
 * X6 — 영속성. Prisma 클라이언트 보유와 트랜잭션 경계 제공.
 *
 * 애플리케이션 서비스는 Prisma 타입을 직접 import 하지 않는다.
 * 리포지토리 구현체만 이 모듈을 통해 DB에 접근한다 (설계 위반 판정 #2).
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * 트랜잭션은 서비스가 열고 서비스가 닫는다. 리포지토리는 트랜잭션을 열지 않는다.
 * 트랜잭션 경계 목록: services.md 4절 (T1~T7)
 */
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => work(tx));
}

/** 필수 환경변수 확인. 누락 시 기동을 실패시킨다 (BR-U1-022). */
export function verifyRequiredEnv(): void {
  const required = ["DATABASE_URL", "SESSION_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `필수 환경변수가 없습니다: ${missing.join(", ")}\n` +
        `.env.example을 복사해 .env를 만들고 값을 채워주세요.`,
    );
  }
}
