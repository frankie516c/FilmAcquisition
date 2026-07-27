/**
 * 시드 데이터 — business-logic-model.md 8절 명세를 따른다.
 *
 * 멱등성 (BR-U1-023): User 테이블이 비어 있을 때만 실행한다.
 * 사용자 없이 시스템이 동작할 수 없으므로 가장 신뢰할 수 있는 지표다.
 *
 * 모든 만료일은 실행 시각 기준 상대값이다. 고정 날짜를 쓰면 며칠 뒤 다시 돌렸을 때
 * 전부 만료 상태가 되어 마감 임박 위젯이 제 기능을 보여주지 못한다.
 */

import { PrismaClient, type Genre, type ProductionCountry, type Rating, type Stage } from "@prisma/client";
import { argon2id } from "hash-wasm";
import { randomBytes } from "node:crypto";

/** src/platform/password.ts와 동일한 파라미터. seed는 @/ 별칭을 쓰지 않으므로 여기서 재현한다. */
const hash = (password: string) =>
  argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19_456,
    hashLength: 32,
    outputType: "encoded",
  });

const prisma = new PrismaClient();
const DAY = 86_400_000;
const NOW = Date.now();
const rel = (days: number) => new Date(NOW + days * DAY);
const 억 = 100_000_000n;

interface SeedTitle {
  key: string;
  titleKo: string;
  titleOriginal: string;
  director: string;
  genres: Genre[];
  country: ProductionCountry;
  year: number;
  rating: Rating;
  stage: Stage;
  ageDays: number;
  assignee: "scout1" | "scout2";
}

const TITLES: SeedTitle[] = [
  // 발굴 5
  { key: "t1", titleKo: "조용한 이주", titleOriginal: "Quiet Passage", director: "한서진", genres: ["DRAMA"], country: "KR", year: 2025, rating: "TWELVE", stage: "DISCOVERY", ageDays: 46, assignee: "scout1" },
  { key: "t2", titleKo: "붉은 해안선", titleOriginal: "Red Shoreline", director: "M. Duval", genres: ["THRILLER"], country: "FR", year: 2024, rating: "FIFTEEN", stage: "DISCOVERY", ageDays: 39, assignee: "scout1" },
  { key: "t3", titleKo: "아홉 번째 여름", titleOriginal: "The Ninth Summer", director: "오재하", genres: ["ROMANCE"], country: "KR", year: 2025, rating: "TWELVE", stage: "DISCOVERY", ageDays: 31, assignee: "scout2" },
  { key: "t4", titleKo: "기계 도시", titleOriginal: "Machine City", director: "K. Brennan", genres: ["SF", "ACTION"], country: "US", year: 2025, rating: "FIFTEEN", stage: "DISCOVERY", ageDays: 22, assignee: "scout1" },
  { key: "t5", titleKo: "산 아래 사람들", titleOriginal: "Under the Mountain", director: "이도경", genres: ["DOCUMENTARY"], country: "KR", year: 2024, rating: "ALL", stage: "DISCOVERY", ageDays: 12, assignee: "scout2" },
  // 스크리닝 4
  { key: "t6", titleKo: "겨울의 정거장", titleOriginal: "Winter Terminal", director: "J. Halvorsen", genres: ["DRAMA"], country: "GB", year: 2024, rating: "TWELVE", stage: "SCREENING", ageDays: 72, assignee: "scout1" },
  { key: "t7", titleKo: "이중 노출", titleOriginal: "Double Exposure", director: "박민혁", genres: ["THRILLER", "MYSTERY"], country: "KR", year: 2025, rating: "FIFTEEN", stage: "SCREENING", ageDays: 64, assignee: "scout2" },
  { key: "t8", titleKo: "백일의 항해", titleOriginal: "Hundred Day Voyage", director: "T. Nakamura", genres: ["ANIMATION"], country: "JP", year: 2024, rating: "ALL", stage: "SCREENING", ageDays: 55, assignee: "scout1" },
  { key: "t9", titleKo: "웃는 얼굴", titleOriginal: "The Laughing Face", director: "정하늘", genres: ["COMEDY"], country: "KR", year: 2025, rating: "TWELVE", stage: "SCREENING", ageDays: 41, assignee: "scout2" },
  // 평가 4
  { key: "t10", titleKo: "마지막 통화", titleOriginal: "The Last Call", director: "R. Okafor", genres: ["THRILLER"], country: "GB", year: 2024, rating: "FIFTEEN", stage: "EVALUATION", ageDays: 95, assignee: "scout1" },
  { key: "t11", titleKo: "유리 온실", titleOriginal: "Glass Greenhouse", director: "윤소라", genres: ["DRAMA", "ROMANCE"], country: "KR", year: 2025, rating: "TWELVE", stage: "EVALUATION", ageDays: 88, assignee: "scout2" },
  { key: "t12", titleKo: "대륙 횡단", titleOriginal: "Crossing the Continent", director: "L. Marchetti", genres: ["DOCUMENTARY"], country: "FR", year: 2024, rating: "ALL", stage: "EVALUATION", ageDays: 70, assignee: "scout1" },
  { key: "t13", titleKo: "불면의 도시", titleOriginal: "Sleepless City", director: "강태우", genres: ["MYSTERY"], country: "KR", year: 2025, rating: "FIFTEEN", stage: "EVALUATION", ageDays: 58, assignee: "scout2" },
  // 오퍼 3
  { key: "t14", titleKo: "일곱 개의 문", titleOriginal: "Seven Doors", director: "A. Kowalski", genres: ["HORROR"], country: "US", year: 2024, rating: "ADULT", stage: "OFFER", ageDays: 120, assignee: "scout1" },
  { key: "t15", titleKo: "해협의 밤", titleOriginal: "Night on the Strait", director: "서지운", genres: ["DRAMA"], country: "KR", year: 2024, rating: "TWELVE", stage: "OFFER", ageDays: 104, assignee: "scout2" },
  { key: "t16", titleKo: "작은 반란", titleOriginal: "Small Rebellion", director: "C. Vega", genres: ["COMEDY"], country: "US", year: 2025, rating: "TWELVE", stage: "OFFER", ageDays: 83, assignee: "scout1" },
  // 협상 2
  { key: "t17", titleKo: "철의 계절", titleOriginal: "Iron Season", director: "임현우", genres: ["WAR", "DRAMA"], country: "KR", year: 2024, rating: "FIFTEEN", stage: "NEGOTIATION", ageDays: 142, assignee: "scout1" },
  { key: "t18", titleKo: "별빛 아래서", titleOriginal: "Beneath Starlight", director: "S. Fitzgerald", genres: ["ROMANCE"], country: "GB", year: 2024, rating: "TWELVE", stage: "NEGOTIATION", ageDays: 128, assignee: "scout2" },
  // 계약체결 4 — 스릴러·로맨스·다큐가 0건이 되도록 의도적으로 구성한다 (라인업 갭 시연)
  { key: "t19", titleKo: "서편의 노래", titleOriginal: "Song of the West", director: "최윤아", genres: ["DRAMA"], country: "KR", year: 2023, rating: "ALL", stage: "CLOSED_WON", ageDays: 210, assignee: "scout1" },
  { key: "t20", titleKo: "궤도 이탈", titleOriginal: "Off Orbit", director: "D. Sokolov", genres: ["ACTION", "SF"], country: "US", year: 2024, rating: "FIFTEEN", stage: "CLOSED_WON", ageDays: 186, assignee: "scout2" },
  { key: "t21", titleKo: "오후의 소동", titleOriginal: "Afternoon Riot", director: "노경민", genres: ["COMEDY"], country: "KR", year: 2024, rating: "TWELVE", stage: "CLOSED_WON", ageDays: 165, assignee: "scout1" },
  { key: "t22", titleKo: "두 개의 이름", titleOriginal: "Two Names", director: "H. Yamada", genres: ["DRAMA"], country: "JP", year: 2023, rating: "TWELVE", stage: "CLOSED_WON", ageDays: 240, assignee: "scout2" },
  // 반려 2
  { key: "t23", titleKo: "깊은 물", titleOriginal: "Deep Water", director: "P. Aubert", genres: ["THRILLER"], country: "FR", year: 2023, rating: "ADULT", stage: "REJECTED", ageDays: 190, assignee: "scout1" },
  { key: "t24", titleKo: "모래의 기록", titleOriginal: "Record of Sand", director: "김도윤", genres: ["DOCUMENTARY"], country: "KR", year: 2024, rating: "ALL", stage: "REJECTED", ageDays: 150, assignee: "scout2" },
];

const STAGE_ORDER: Stage[] = ["DISCOVERY", "SCREENING", "EVALUATION", "OFFER", "NEGOTIATION", "CLOSED_WON", "REJECTED"];

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("시드 데이터가 이미 존재합니다. 건너뜁니다.");
    return;
  }

  // ⚠️ BR-U1-025 — 로컬 PoC 전용 공개 비밀번호. 실제 운영에 사용할 수 없다.
  const password = process.env.SEED_PASSWORD ?? "demo1234";
  const passwordHash = await hash(password);

  // Executive를 2명 두는 것이 중요하다 — 마지막 관리자 보호(US-029)의
  // "정상 처리" 경로와 "거부" 경로를 모두 확인하려면 2명에서 시작해야 한다.
  const [scout1, scout2, analyst, exec1] = await Promise.all([
    prisma.user.create({ data: { email: "scout1@fad.local", name: "김스카우트", role: "SCOUT", passwordHash } }),
    prisma.user.create({ data: { email: "scout2@fad.local", name: "박스카우트", role: "SCOUT", passwordHash } }),
    prisma.user.create({ data: { email: "analyst@fad.local", name: "이분석", role: "ANALYST", passwordHash } }),
    prisma.user.create({ data: { email: "exec1@fad.local", name: "최경영", role: "EXECUTIVE", passwordHash } }),
    prisma.user.create({ data: { email: "exec2@fad.local", name: "정경영", role: "EXECUTIVE", passwordHash } }),
  ]);

  const scouts = { scout1: scout1.id, scout2: scout2.id };
  const ids = new Map<string, string>();

  for (const t of TITLES) {
    const createdAt = rel(-t.ageDays);
    const title = await prisma.title.create({
      data: {
        titleKo: t.titleKo,
        titleOriginal: t.titleOriginal,
        director: t.director,
        genres: t.genres,
        productionCountry: t.country,
        productionYear: t.year,
        rating: t.rating,
        stage: t.stage,
        assigneeId: scouts[t.assignee],
        createdAt,
      },
    });
    ids.set(t.key, title.id);

    // 단계 이력 — 전환 시각을 과거로 분산시켜 체류 일수가 0이 아니게 만든다.
    // 시드가 모두 "오늘 생성"이면 병목 단계 계산이 전부 0일이 되어 위젯이 무의미해진다.
    const targetIndex = STAGE_ORDER.indexOf(t.stage);
    const path = targetIndex >= 5
      ? [1, 2, 3, 4, targetIndex]
      : Array.from({ length: targetIndex }, (_, i) => i + 1);

    await prisma.stageTransition.create({
      data: { titleId: title.id, fromStage: null, toStage: "DISCOVERY", occurredAt: createdAt, changedById: scouts[t.assignee] },
    });
    for (let i = 0; i < path.length; i++) {
      const fromIdx = i === 0 ? 0 : path[i - 1]!;
      await prisma.stageTransition.create({
        data: {
          titleId: title.id,
          fromStage: STAGE_ORDER[fromIdx]!,
          toStage: STAGE_ORDER[path[i]!]!,
          occurredAt: rel(-t.ageDays + Math.round(t.ageDays * ((i + 1) / (path.length + 1)))),
          changedById: scouts[t.assignee],
        },
      });
    }
  }

  const id = (key: string) => ids.get(key)!;

  // 평가 8편 — 그중 2편(t11, t15)은 두 Scout가 각각 평가해 복수 평가 평균을 보여준다
  const evals: [string, string, number, number, number, number, string][] = [
    ["t10", scout1.id, 5, 3, 4, 4, "연출 밀도가 높다. 후반 30분이 압도적."],
    ["t10", scout2.id, 4, 4, 4, 3, "상업성은 중간이나 평단 반응이 좋을 것."],
    ["t11", scout2.id, 4, 4, 5, 4, "타깃 관객층이 명확하고 입소문 여지가 크다."],
    ["t14", scout1.id, 3, 5, 4, 5, "장르 팬층 확실. 개봉 시기만 잘 잡으면 된다."],
    ["t15", scout1.id, 5, 3, 3, 4, "작품성 최상. 마케팅 난이도가 관건."],
    ["t15", scout2.id, 4, 3, 4, 4, "시사 반응 양호. 평론가 시사를 먼저 돌리자."],
    ["t17", scout1.id, 4, 4, 4, 4, "규모 대비 완성도가 높다."],
    ["t19", scout1.id, 5, 4, 4, 5, "라인업의 중심이 될 작품."],
    ["t20", scout2.id, 3, 5, 5, 4, "화제성 최상. 시리즈화 여지도 있음."],
    ["t7", scout2.id, 4, 3, 3, 4, "스릴러 문법에 충실."],
  ];
  for (const [key, evaluatorId, artistry, commerciality, buzz, targetFit, overallComment] of evals) {
    await prisma.evaluation.create({
      data: { titleId: id(key), evaluatorId, artistry, commerciality, buzz, targetFit, overallComment },
    });
  }

  // 코멘트 + 멘션 알림 (트랜잭션 T4의 결과 형태)
  const mention = await prisma.comment.create({
    data: { titleId: id("t15"), authorId: scout1.id, body: "@이분석 오퍼 유효기간 임박입니다. 조건 재확인 부탁드려요." },
  });
  await prisma.notification.create({
    data: {
      userId: analyst.id, type: "MENTION", titleId: id("t15"), commentId: mention.id,
      marker: mention.id,
      dedupeKey: `mention:${mention.id}`, // src/domain/notification-key.ts 의 mentionKey와 동일
      message: "김스카우트님이 «해협의 밤» 코멘트에서 회원님을 언급했습니다",
    },
  });
  await prisma.comment.create({ data: { titleId: id("t10"), authorId: scout2.id, body: "시사 일정 잡았습니다. 목요일 오후 3시." } });
  await prisma.comment.create({ data: { titleId: id("t19"), authorId: exec1.id, body: "라인업 갭 고려하면 이 작품은 확보하는 게 맞습니다." } });

  // 영화제 이력
  await prisma.festivalRecord.createMany({
    data: [
      { titleId: id("t10"), festivalName: "베를린 국제영화제", year: 2024, section: "COMPETITION", isAward: true, awardName: "은곰상 각본상" },
      { titleId: id("t15"), festivalName: "칸 영화제", year: 2024, section: "COMPETITION", isAward: false },
      { titleId: id("t19"), festivalName: "부산국제영화제", year: 2023, section: "COMPETITION", isAward: true, awardName: "뉴커런츠상" },
      { titleId: id("t20"), festivalName: "토론토 국제영화제", year: 2024, section: "NON_COMPETITION", isAward: false },
    ],
  });

  // 딜 12편. 만료 임박: D-3(t15) · D-6(t16) · D-1(t17) · 이미 만료(t14)
  const deals: [string, bigint, bigint, bigint | null, number, number, number | null, string][] = [
    ["t10", 12n * 억, 9n * 억, 8n * 억, 12.5, -20, 30, "극장 우선 개봉, 홀드백 4개월"],
    ["t11", 7n * 억, 6n * 억, 5n * 억, 10, -15, 45, "디지털 동시 개봉 허용"],
    ["t14", 9n * 억, 7n * 억, null, 8, -30, -5, "만료됨 — 재협상 필요"],
    ["t15", 20n * 억, 16n * 억, 15n * 억, 15, -40, 3, "전국 400개관 이상 확약 조건"],
    ["t16", 11n * 억, 9n * 억, 8n * 억, 11, -25, 6, "프로모션 소재 제작사 제공"],
    ["t17", 6n * 억, 5n * 억, 4n * 억, 9, -18, 1, "성수기 개봉 확약"],
    ["t18", 25n * 억, 21n * 억, 20n * 억, 14, -60, 60, "2년 독점, 부가판권 포함"],
    ["t13", 14n * 억, 12n * 억, 11n * 억, 13, -55, 75, "OTT 홀드백 6개월"],
    ["t19", 18n * 억, 15n * 억, 14n * 억, 12, -190, null, "체결 완료"],
    ["t20", 32n * 억, 28n * 억, 26n * 억, 16, -170, null, "체결 완료"],
    ["t21", 8n * 억, 7n * 억, 6n * 억, 10, -150, null, "체결 완료"],
    ["t22", 13n * 억, 11n * 억, 10n * 억, 12, -220, null, "체결 완료"],
  ];
  for (const [key, ask, offer, mg, rate, sub, exp, terms] of deals) {
    await prisma.deal.create({
      data: {
        titleId: id(key), askingPrice: ask, offerAmount: offer, minimumGuarantee: mg,
        runningRoyaltyRate: rate, offerSubmittedAt: rel(sub),
        offerExpiryDate: exp === null ? null : rel(exp), contractTerms: terms,
      },
    });
  }

  // 재무 8편 — t20은 ROI가 음수가 되도록 구성한다 (손실 케이스 표시 확인)
  // t19의 예상 매출 300억은 4바이트 정수 한계(약 21억)를 넘는다.
  // 시드가 이 값을 포함하는 것은 의도적이다 — BigInt 선택이 실제로 필요했음이 여기서 드러난다.
  const fins: [string, bigint, bigint, bigint][] = [
    ["t10", 14n * 억, 2n * 억, 38n * 억],
    ["t11", 9n * 억, 1n * 억, 22n * 억],
    ["t15", 28n * 억, 3n * 억, 52n * 억],
    ["t16", 13n * 억, 2n * 억, 26n * 억],
    ["t18", 35n * 억, 4n * 억, 120n * 억],
    ["t17", 22n * 억, 3n * 억, 44n * 억],
    ["t19", 26n * 억, 3n * 억, 300n * 억],
    ["t20", 40n * 억, 5n * 억, 58n * 억],
  ];
  for (const [key, pa, other, revenue] of fins) {
    await prisma.financialModel.create({
      data: { titleId: id(key), paAndBudget: pa, otherCosts: other, expectedRevenue: revenue },
    });
  }

  // 판권 4편 — t20은 D-21로 두어 30일 범위에서만 보이고 7일 범위에서는 안 보이게 한다
  await prisma.rightsGrant.createMany({
    data: [
      { titleId: id("t19"), territories: ["KR"], contractStartDate: rel(-180), contractEndDate: rel(545) },
      { titleId: id("t20"), territories: ["KR", "JP"], contractStartDate: rel(-160), contractEndDate: rel(21) },
      { titleId: id("t21"), territories: ["KR"], contractStartDate: rel(-140), contractEndDate: rel(400) },
      { titleId: id("t22"), territories: ["ASIA"], contractStartDate: rel(-210), contractEndDate: rel(885) },
    ],
  });

  console.log(`시드 완료 — 사용자 5명, 작품 ${TITLES.length}편, 딜 ${deals.length}건, 재무 ${fins.length}건`);
  console.log(`데모 계정 비밀번호: ${password}  (⚠️ 로컬 PoC 전용)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
