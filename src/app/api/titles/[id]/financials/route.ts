import { NextResponse } from "next/server";
import { getFinancials, saveFinancialInput } from "@/modules/deals/service";
import { requireContext } from "@/platform/context";
import { financialInputSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const view = await getFinancials(ctx, id);
    return NextResponse.json({
      financials: view ? serialize(ctx.role, "FinancialModel", view) : null,
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(financialInputSchema, await request.json());
    const view = await saveFinancialInput(ctx, id, input);
    return NextResponse.json({ financials: serialize(ctx.role, "FinancialModel", view) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
