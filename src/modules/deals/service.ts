/**
 * C5 DealComponent — 딜·판권·재무.
 *
 * 재무 산식은 D1만 알고 있다. 이 서비스는 호출만 한다 (NFR-008).
 */

import { prisma, runInTransaction } from "@/platform/db";
import { requireRole, type Ctx } from "@/platform/context";
import { NotFoundError } from "@/platform/errors";
import {
  calculateFinancials,
  selectAcquisitionBase,
  type FinancialResult,
} from "@/domain/financials";

export interface DealInput {
  askingPrice?: bigint | null;
  offerAmount?: bigint | null;
  offerSubmittedAt?: Date | null;
  offerExpiryDate?: Date | null;
  minimumGuarantee?: bigint | null;
  runningRoyaltyRate?: number | null;
  contractTerms?: string | null;
}

export async function saveDeal(ctx: Ctx, titleId: string, input: DealInput) {
  requireRole(ctx, "ANALYST"); // Scout·Executive는 여기서 403

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  return prisma.deal.upsert({
    where: { titleId },
    create: { titleId, ...input },
    update: input,
  });
}

export interface RightsInput {
  territories: string[];
  contractStartDate: Date;
  contractEndDate: Date;
}

export async function saveRights(ctx: Ctx, titleId: string, input: RightsInput) {
  requireRole(ctx, "ANALYST");

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  // 영토·기간이 겹쳐도 저장한다. 권리 충돌 검증은 범위 밖이다 (US-015).
  return prisma.rightsGrant.create({
    data: {
      titleId,
      territories: input.territories as never,
      contractStartDate: input.contractStartDate,
      contractEndDate: input.contractEndDate,
    },
  });
}

export interface FinancialInputDto {
  paAndBudget: bigint;
  otherCosts: bigint;
  expectedRevenue: bigint;
}

export interface FinancialView extends FinancialResult {
  paAndBudget: bigint;
  otherCosts: bigint;
  expectedRevenue: bigint;
}

export async function saveFinancialInput(
  ctx: Ctx,
  titleId: string,
  input: FinancialInputDto,
): Promise<FinancialView> {
  requireRole(ctx, "ANALYST");

  const title = await prisma.title.findUnique({
    where: { id: titleId },
    include: { deal: true },
  });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  const saved = await prisma.financialModel.upsert({
    where: { titleId },
    create: { titleId, ...input },
    update: input,
  });

  return toView(saved, title.deal);
}

export interface DealWithFinancialsInput {
  deal: DealInput;
  /** 재무는 선택 — 딜만 기록하고 수익성은 나중에 넣는 경우가 있다 */
  financials?: FinancialInputDto;
}

export interface DealWithFinancialsResult {
  deal: Awaited<ReturnType<typeof saveDeal>>;
  financials: FinancialView | null;
}

/**
 * 딜과 재무를 **하나의 트랜잭션**으로 저장한다.
 *
 * 화면에서는 둘이 한 폼이고 사용자에게도 한 번의 저장이다. 그런데 API가 나뉘어 있으면
 * 딜만 저장되고 재무가 실패하는 중간 상태가 생긴다. 사용자는 "저장 실패"를 보지만
 * 딜은 이미 바뀌어 있어, 무엇이 반영됐는지 알 수 없다.
 *
 * 재무 계산은 **같은 트랜잭션에서 방금 저장한 딜**을 기준으로 한다.
 * 이전 딜 값으로 계산하면 MG를 바꾼 즉시의 응답이 옛 값 기준이 되어 화면과 어긋난다.
 */
export async function saveDealAndFinancials(
  ctx: Ctx,
  titleId: string,
  input: DealWithFinancialsInput,
): Promise<DealWithFinancialsResult> {
  requireRole(ctx, "ANALYST");

  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) throw new NotFoundError("작품을 찾을 수 없습니다.");

  return runInTransaction(async (tx) => {
    const deal = await tx.deal.upsert({
      where: { titleId },
      create: { titleId, ...input.deal },
      update: input.deal,
    });

    if (!input.financials) return { deal, financials: null };

    const model = await tx.financialModel.upsert({
      where: { titleId },
      create: { titleId, ...input.financials },
      update: input.financials,
    });

    return { deal, financials: toView(model, deal) };
  });
}

export async function getFinancials(
  ctx: Ctx,
  titleId: string,
): Promise<FinancialView | null> {
  // 조회는 Analyst·Executive만. Scout는 필드 정책에서도 차단되지만,
  // 서비스 진입에서 먼저 막아 불필요한 조회 자체를 하지 않는다.
  requireRole(ctx, "ANALYST", "EXECUTIVE");

  const title = await prisma.title.findUnique({
    where: { id: titleId },
    include: { deal: true, financialModel: true },
  });
  if (!title?.financialModel) return null;

  return toView(title.financialModel, title.deal);
}

function toView(
  model: { paAndBudget: bigint; otherCosts: bigint; expectedRevenue: bigint },
  deal: { minimumGuarantee: bigint | null; offerAmount: bigint | null } | null,
): FinancialView {
  const result = calculateFinancials({
    offerAmount: selectAcquisitionBase(deal?.minimumGuarantee, deal?.offerAmount),
    paAndBudget: model.paAndBudget,
    otherCosts: model.otherCosts,
    expectedRevenue: model.expectedRevenue,
  });
  return { ...result, ...model };
}
