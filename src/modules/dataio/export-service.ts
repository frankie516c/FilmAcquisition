/**
 * C7 DataIOComponent — 내보내기.
 *
 * ⚠️ 호출 순서가 설계의 핵심이다: 직렬화 게이트 → CSV 생성.
 * 역순이면 마스킹 대상 값이 이미 문자열에 포함된 뒤 제거를 시도하게 된다.
 */

import { listTitles, type TitleFilter } from "@/modules/titles/repository";
import { gateExportRows, type ExportColumn } from "@/platform/authz/serialize";
import { serializeToCsv } from "@/domain/csv";
import { calculateFinancials, selectAcquisitionBase } from "@/domain/financials";
import { calculateOverallScore } from "@/domain/score";
import { getStageLabel, type Stage } from "@/domain/pipeline-rules";
import { formatDate } from "@/domain/calendar";
import { requireRole, type Ctx } from "@/platform/context";

/** 컬럼마다 소속 엔티티를 선언한다 — 정책 판정의 기준이 된다 */
const COLUMNS: ExportColumn[] = [
  { key: "titleKo", header: "제목", entity: "Title" },
  { key: "titleOriginal", header: "원제", entity: "Title" },
  { key: "director", header: "감독", entity: "Title" },
  { key: "productionYear", header: "제작연도", entity: "Title" },
  { key: "stage", header: "단계", entity: "Title" },
  { key: "assignee", header: "담당자", entity: "Title" },
  { key: "score", header: "종합점수", entity: "Title" },
  // ↓ Deal — Scout에게는 offerAmount·offerExpiryDate만 열려 있다
  { key: "offerAmount", header: "오퍼금액", entity: "Deal" },
  { key: "offerExpiryDate", header: "오퍼만료일", entity: "Deal" },
  { key: "askingPrice", header: "요청가", entity: "Deal" },
  { key: "minimumGuarantee", header: "MG", entity: "Deal" },
  { key: "runningRoyaltyRate", header: "러닝로열티율", entity: "Deal" },
  { key: "contractTerms", header: "계약조건", entity: "Deal" },
  // ↓ FinancialModel — Scout에게는 엔티티 전체가 차단된다
  { key: "expectedRevenue", header: "예상매출", entity: "FinancialModel" },
  { key: "totalAcquisitionCost", header: "총인수비용", entity: "FinancialModel" },
  { key: "expectedProfit", header: "예상손익", entity: "FinancialModel" },
  { key: "roiPercent", header: "ROI(%)", entity: "FinancialModel" },
];

export interface ExportResult {
  filename: string;
  content: string;
  rowCount: number;
  /** 정책에 의해 빠진 컬럼 — 화면에 안내하기 위해 함께 반환한다 */
  omittedColumns: string[];
}

export async function exportTitles(ctx: Ctx, filter: TitleFilter): Promise<ExportResult> {
  requireRole(ctx, "SCOUT", "ANALYST");

  const titles = await listTitles(filter);
  const withFinancials = await attachFinancials(titles.map((t) => t.id));

  const raw = titles.map((t) => {
    const fin = withFinancials.get(t.id);
    return {
      titleKo: t.titleKo,
      titleOriginal: t.titleOriginal,
      director: t.director,
      productionYear: t.productionYear,
      stage: getStageLabel(t.stage as Stage),
      assignee: t.assignee?.name ?? "",
      score: calculateOverallScore(t.evaluations)?.score ?? "",
      offerAmount: t.deal?.offerAmount,
      offerExpiryDate: t.deal?.offerExpiryDate ? formatDate(t.deal.offerExpiryDate) : null,
      askingPrice: t.deal?.askingPrice,
      minimumGuarantee: t.deal?.minimumGuarantee,
      runningRoyaltyRate: t.deal?.runningRoyaltyRate,
      contractTerms: t.deal?.contractTerms,
      expectedRevenue: fin?.expectedRevenue,
      totalAcquisitionCost: fin?.totalAcquisitionCost,
      expectedProfit: fin?.expectedProfit,
      roiPercent: fin?.roiPercent,
    };
  });

  // ★ 게이트를 먼저 통과시키고, 그 결과만 파일 생성 단계로 넘긴다
  const gated = gateExportRows(ctx.role, COLUMNS, raw);
  const content = serializeToCsv(gated.rows, gated.columns);

  const allowedKeys = new Set(gated.columns.map((c) => c.key));
  return {
    filename: `titles-${formatDate(ctx.now)}.csv`,
    content,
    rowCount: gated.rows.length,
    omittedColumns: COLUMNS.filter((c) => !allowedKeys.has(c.key)).map((c) => c.header),
  };
}

async function attachFinancials(titleIds: string[]) {
  const { prisma } = await import("@/platform/db");
  const models = await prisma.financialModel.findMany({
    where: { titleId: { in: titleIds } },
    include: { title: { select: { deal: true } } },
  });

  const map = new Map<string, ReturnType<typeof calculateFinancials> & { expectedRevenue: bigint }>();
  for (const m of models) {
    const result = calculateFinancials({
      offerAmount: selectAcquisitionBase(
        m.title.deal?.minimumGuarantee,
        m.title.deal?.offerAmount,
      ),
      paAndBudget: m.paAndBudget,
      otherCosts: m.otherCosts,
      expectedRevenue: m.expectedRevenue,
    });
    map.set(m.titleId, { ...result, expectedRevenue: m.expectedRevenue });
  }
  return map;
}
