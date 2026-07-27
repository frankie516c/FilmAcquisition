/**
 * 응답 시간 측정 — NFR-001 목표 대비 실측.
 *
 * 실행: npx tsx --env-file-if-exists=.env scripts/measure.ts [반복횟수]
 *
 * 첫 요청은 서버 초기화·커넥션 워밍업이 섞이므로 버린다.
 * p95는 정렬 후 ceil(n × 0.95) − 1 위치를 취한다.
 */

// import 문이 없으면 TypeScript가 이 파일을 모듈이 아닌 전역 스크립트로 보아
// 다른 스크립트와 최상위 이름이 충돌한다. 빈 export로 모듈임을 명시한다.
export {};

const BASE = process.env.FAD_BASE_URL || "http://localhost:3100";
const PASSWORD = process.env.SEED_PASSWORD || "demo1234";

interface Target {
  label: string;
  path: string;
  /** NFR-001 목표(ms). 없으면 목표 미정의 */
  budget?: number;
  as: "SCOUT" | "ANALYST";
}

const TARGETS: Target[] = [
  { label: "작품 목록 /titles", path: "/titles", budget: 500, as: "ANALYST" },
  { label: "대시보드 /dashboard", path: "/dashboard", budget: 2000, as: "ANALYST" },
  { label: "칸반 /board", path: "/board", as: "ANALYST" },
  { label: "CSV 내보내기", path: "/api/export/titles", as: "ANALYST" },
  { label: "작품 목록(필터)", path: "/titles?stage=OFFER", budget: 500, as: "ANALYST" },
];

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`로그인 실패 ${email}: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, idx)]!;
}

async function measure(cookie: string, path: string, runs: number) {
  // 워밍업 — 결과에 포함하지 않는다
  await fetch(`${BASE}${path}`, { headers: { cookie } }).then((r) => r.arrayBuffer());

  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    await res.arrayBuffer(); // 본문까지 다 받아야 실제 소요다
    times.push(performance.now() - t0);
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  }

  const sorted = [...times].sort((a, b) => a - b);
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: sorted[0]!,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]!,
  };
}

async function main() {
  const runs = Number(process.argv[2]) || 20;
  const [scout, analyst] = await Promise.all([
    login("scout1@fad.local"),
    login("analyst@fad.local"),
  ]);
  const cookies = { SCOUT: scout, ANALYST: analyst };

  // 규모를 함께 기록해야 측정이 의미를 갖는다
  const listRes = await fetch(`${BASE}/api/export/titles`, { headers: { cookie: analyst } });
  const rowCount = listRes.headers.get("x-row-count");
  console.log(`대상 규모: 작품 ${rowCount}편 · 측정 ${runs}회(워밍업 1회 제외)\n`);

  const rows: string[] = [];
  rows.push("경로                        평균     최소     p50      p95      최대     목표     판정");
  rows.push("─".repeat(88));

  for (const t of TARGETS) {
    const m = await measure(cookies[t.as], t.path, runs);
    const budget = t.budget ? `${t.budget}ms` : "—";
    const verdict = t.budget ? (m.p95 <= t.budget ? "✅ 충족" : "❌ 초과") : "—";
    rows.push(
      t.label.padEnd(26) +
        `${m.avg.toFixed(0).padStart(6)}ms` +
        `${m.min.toFixed(0).padStart(7)}ms` +
        `${m.p50.toFixed(0).padStart(7)}ms` +
        `${m.p95.toFixed(0).padStart(7)}ms` +
        `${m.max.toFixed(0).padStart(7)}ms` +
        budget.padStart(9) +
        "  " + verdict,
    );
  }

  console.log(rows.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
