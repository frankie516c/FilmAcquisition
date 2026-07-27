import { NextResponse } from "next/server";
import { saveDealAndFinancials } from "@/modules/deals/service";
import { requireContext } from "@/platform/context";
import { dealWithFinancialsSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

/**
 * 딜과 재무를 하나의 동작으로 저장한다.
 *
 * 화면의 편집 폼이 이 엔드포인트를 쓴다. 개별 엔드포인트
 * (`/deal`, `/financials`)는 부분 수정용으로 남아 있다.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(dealWithFinancialsSchema, await request.json());

    const result = await saveDealAndFinancials(ctx, id, input);

    return NextResponse.json({
      deal: serialize(ctx.role, "Deal", result.deal),
      financials: result.financials
        ? serialize(ctx.role, "FinancialModel", result.financials)
        : null,
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
