/**
 * CSV 가져오기 성능 측정 — NFR-001의 "500행 처리 10초 이내" 검증.
 *
 * 실행: npx tsx --env-file-if-exists=.env scripts/measure-import.ts [행수]
 *
 * 생성되는 작품은 "[대량]"으로 시작하므로 bulk-titles.ts --clean 으로 함께 정리된다.
 */

// measure.ts와 같은 이유로 모듈임을 명시한다 (최상위 이름 충돌 방지)
export {};

const BASE = process.env.FAD_BASE_URL || "http://localhost:3100";
const PASSWORD = process.env.SEED_PASSWORD || "demo1234";
const BOM = "﻿";

const GENRES = ["드라마", "스릴러", "코미디", "액션", "로맨스", "다큐멘터리"];

function buildCsv(rows: number): string {
  const lines = ["제목,원제,감독,제작연도,장르,시놉시스"];
  for (let i = 1; i <= rows; i++) {
    const genre = GENRES[i % GENRES.length]!;
    // 쉼표와 따옴표가 든 값을 섞어 인용 처리 비용도 함께 잰다
    const synopsis = `"가져오기 성능 측정용 ${i}행, 쉼표와 ""따옴표"" 포함"`;
    lines.push(`[대량] 수입 ${String(i).padStart(4, "0")},Bulk Import ${i},감독${i % 30},202${i % 5},${genre},${synopsis}`);
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`로그인 실패: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

async function post(cookie: string, csv: string, mode?: string) {
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "bulk.csv");
  if (mode) form.append("mode", mode);

  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/import/titles`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const body = await res.json();
  return { ms: performance.now() - t0, status: res.status, body };
}

async function main() {
  const rows = Number(process.argv[2]) || 500;
  const cookie = await login("scout1@fad.local");
  const csv = buildCsv(rows);

  console.log(`CSV ${rows}행 · ${(csv.length / 1024).toFixed(1)}KB\n`);

  const preview = await post(cookie, csv);
  console.log(
    `미리보기  ${preview.ms.toFixed(0).padStart(6)}ms  ` +
      `HTTP ${preview.status}  정상 ${preview.body.validCount}행 / 전체 ${preview.body.totalRows}행`,
  );

  const commit = await post(cookie, csv, "VALID_ONLY");
  console.log(
    `반영      ${commit.ms.toFixed(0).padStart(6)}ms  ` +
      `HTTP ${commit.status}  반영 ${commit.body.imported}건 / 제외 ${commit.body.skipped}건`,
  );

  const total = preview.ms + commit.ms;
  const budget = 10_000;
  console.log(
    `\n합계      ${total.toFixed(0)}ms  (목표 ${budget}ms)  ` +
      `${total <= budget ? "✅ 충족" : "❌ 초과"} — 목표의 ${((total / budget) * 100).toFixed(0)}% 사용`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
