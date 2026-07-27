/**
 * 성능 검증용 대량 데이터 생성 — NFR-001의 목표 규모(작품 500건)를 만든다.
 *
 * 실행: npx tsx --env-file-if-exists=.env scripts/bulk-titles.ts [목표건수]
 * 정리: npx tsx --env-file-if-exists=.env scripts/bulk-titles.ts --clean
 *
 * ⚠️ 생성된 작품은 titleKo가 "[대량]"으로 시작한다. 정리할 때 이 표식으로만 지우므로
 *    시드 데이터와 사용자가 직접 만든 데이터는 건드리지 않는다.
 */

import { PrismaClient, type Genre, type ProductionCountry, type Stage } from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "[대량]";
const DAY = 86_400_000;

const STAGES: Stage[] = [
  "DISCOVERY", "SCREENING", "EVALUATION", "OFFER", "NEGOTIATION", "CLOSED_WON", "REJECTED",
];
const GENRES: Genre[] = [
  "DRAMA", "THRILLER", "COMEDY", "ACTION", "ROMANCE", "HORROR",
  "SF", "FANTASY", "ANIMATION", "DOCUMENTARY", "MYSTERY", "WAR",
];
const COUNTRIES: ProductionCountry[] = ["KR", "US", "JP", "FR", "GB"];

/** 결정론적 의사난수 — 실행마다 같은 데이터가 나와야 측정이 비교 가능하다 */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

async function clean() {
  const deleted = await prisma.title.deleteMany({ where: { titleKo: { startsWith: MARKER } } });
  console.log(`정리 완료 — ${deleted.count}편 삭제 (하위 데이터는 cascade)`);
  const remaining = await prisma.title.count();
  console.log(`남은 작품: ${remaining}편`);
}

async function main() {
  if (process.argv.includes("--clean")) return clean();

  const target = Number(process.argv[2]) || 500;
  const now = Date.now();
  const rand = rng(20260726);

  const existing = await prisma.title.count();
  const bulkExisting = await prisma.title.count({ where: { titleKo: { startsWith: MARKER } } });
  const toCreate = target - existing;

  console.log(`현재 ${existing}편 (그중 대량 데이터 ${bulkExisting}편) → 목표 ${target}편`);
  if (toCreate <= 0) {
    console.log("이미 목표 규모입니다.");
    return;
  }

  const scouts = await prisma.user.findMany({ where: { role: "SCOUT" }, select: { id: true } });
  if (scouts.length === 0) throw new Error("SCOUT 사용자가 없습니다. 시드를 먼저 적재하세요.");

  // ── 1) 작품 생성 ────────────────────────────────────────────
  const titleData = Array.from({ length: toCreate }, (_, i) => {
    const stage = STAGES[Math.floor(rand() * STAGES.length)]!;
    const ageDays = 30 + Math.floor(rand() * 300);
    const genreCount = 1 + Math.floor(rand() * 2);
    const genres = Array.from(
      new Set(Array.from({ length: genreCount }, () => GENRES[Math.floor(rand() * GENRES.length)]!)),
    );
    return {
      titleKo: `${MARKER} 작품 ${String(i + 1).padStart(4, "0")}`,
      titleOriginal: `Bulk Title ${i + 1}`,
      director: `감독${(i % 40) + 1}`,
      genres,
      productionCountry: COUNTRIES[Math.floor(rand() * COUNTRIES.length)]!,
      productionYear: 2020 + Math.floor(rand() * 6),
      stage,
      assigneeId: scouts[Math.floor(rand() * scouts.length)]!.id,
      createdAt: new Date(now - ageDays * DAY),
    };
  });

  const created = await prisma.title.createManyAndReturn({
    data: titleData,
    select: { id: true, stage: true, createdAt: true },
  });
  console.log(`작품 ${created.length}편 생성`);

  // ── 2) 단계 이력 — 체류 일수 계산에 실제 부하를 준다 ──────────
  const transitions: {
    titleId: string; fromStage: Stage | null; toStage: Stage; occurredAt: Date;
  }[] = [];

  for (const t of created) {
    const targetIndex = STAGES.indexOf(t.stage);
    const ageMs = now - t.createdAt.getTime();
    // 최초 이력
    transitions.push({
      titleId: t.id, fromStage: null, toStage: "DISCOVERY", occurredAt: t.createdAt,
    });
    // 목표 단계까지의 경로 (종료 단계면 중간 단계를 거쳐 도달)
    const path = targetIndex >= 5 ? [1, 2, 3, 4, targetIndex] : Array.from({ length: targetIndex }, (_, i) => i + 1);
    path.forEach((s, i) => {
      transitions.push({
        titleId: t.id,
        fromStage: STAGES[i === 0 ? 0 : path[i - 1]!]!,
        toStage: STAGES[s]!,
        occurredAt: new Date(t.createdAt.getTime() + Math.round(ageMs * ((i + 1) / (path.length + 1)))),
      });
    });
  }

  await prisma.stageTransition.createMany({ data: transitions });
  console.log(`단계 이력 ${transitions.length}건 생성 (작품당 평균 ${(transitions.length / created.length).toFixed(1)}건)`);

  // ── 3) 딜 — 절반 정도 ───────────────────────────────────────
  const 억 = 100_000_000n;
  const dealTargets = created.filter(() => rand() < 0.5);
  await prisma.deal.createMany({
    data: dealTargets.map((t, i) => ({
      titleId: t.id,
      askingPrice: BigInt(5 + (i % 30)) * 억,
      offerAmount: BigInt(4 + (i % 25)) * 억,
      minimumGuarantee: BigInt(3 + (i % 20)) * 억,
      runningRoyaltyRate: 8 + (i % 10),
      offerSubmittedAt: new Date(now - (10 + (i % 60)) * DAY),
      // 일부는 만료 임박 범위에 들어가게 한다
      offerExpiryDate: new Date(now + ((i % 120) - 20) * DAY),
      contractTerms: `대량 데이터 계약 조건 ${i}, 쉼표 포함`,
    })),
  });
  console.log(`딜 ${dealTargets.length}건 생성`);

  // ── 4) 재무 — 1/3 정도 ──────────────────────────────────────
  const finTargets = dealTargets.filter(() => rand() < 0.66);
  await prisma.financialModel.createMany({
    data: finTargets.map((t, i) => ({
      titleId: t.id,
      paAndBudget: BigInt(10 + (i % 30)) * 억,
      otherCosts: BigInt(1 + (i % 5)) * 억,
      expectedRevenue: BigInt(20 + (i % 280)) * 억,
    })),
  });
  console.log(`재무 ${finTargets.length}건 생성`);

  // ── 5) 판권 — 계약체결 작품 ─────────────────────────────────
  const rightsTargets = created.filter((t) => t.stage === "CLOSED_WON");
  await prisma.rightsGrant.createMany({
    data: rightsTargets.map((t, i) => ({
      titleId: t.id,
      territories: i % 2 === 0 ? ["KR"] : ["KR", "JP"],
      contractStartDate: new Date(now - (200 + i) * DAY),
      contractEndDate: new Date(now + ((i % 400) - 30) * DAY),
    })),
  });
  console.log(`판권 ${rightsTargets.length}건 생성`);

  const total = await prisma.title.count();
  console.log(`\n최종 작품 수: ${total}편`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
