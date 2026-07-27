import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    // 기본 실행에서 통합 테스트는 제외한다 — 서버와 DB가 떠 있어야 하므로
    // 단위·속성 테스트처럼 어디서나 돌아가지 않는다.
    include: ["tests/unit/**/*.test.ts", "tests/property/**/*.test.ts"],
    // PBT 설정은 각 테스트 파일에서 numRuns 100 + 고정 시드로 지정한다 (NFR-007, Q8=A)
  },
});
