import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 통합 테스트 전용 설정.
 *
 * 단위·속성 테스트와 분리한 이유: 이 테스트들은 **서버와 DB가 떠 있어야** 동작한다.
 * 기본 `npm test`에 섞으면 환경이 없는 곳에서 전부 실패해, 정작 순수 로직의 회귀를
 * 알려주는 신호까지 묻힌다.
 *
 * 실행 전 준비:
 *   1) PostgreSQL 기동
 *   2) node --env-file=.env node_modules/next/dist/bin/next start -p 3100
 *   3) npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // 같은 데이터를 만지므로 순차 실행한다. 병렬이면 서로의 상태를 깨뜨린다.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
