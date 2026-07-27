/**
 * 비밀번호 해시 — argon2id (BR-U1-003).
 *
 * WASM 구현(hash-wasm)을 쓴다. 네이티브 바인딩 방식(@node-rs/argon2)은 Windows에서
 * MSVC 런타임이 없으면 로드에 실패해 앱 전체가 기동하지 않는다. WASM은 플랫폼별
 * 바이너리가 없어 어디서든 동일하게 동작한다.
 */

import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";

// OWASP 권장 파라미터 (argon2id, 19MiB / 2 iterations / 1 lane)
const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2id({
    password: plain,
    salt: randomBytes(16),
    ...PARAMS,
    outputType: "encoded",
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: plain, hash });
  } catch {
    return false;
  }
}

/**
 * 계정이 없을 때도 검증 연산을 수행하기 위한 더미 해시 (BR-U1-002).
 *
 * 사용자가 없다고 해서 해시 검증을 건너뛰면 응답이 빨라져 계정 존재 여부가
 * 응답 시간으로 드러난다. argon2는 의도적으로 느리므로 이 차이가 측정 가능하다.
 *
 * 한 번만 계산해 재사용한다.
 */
let dummyHash: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  return dummyHash;
}
