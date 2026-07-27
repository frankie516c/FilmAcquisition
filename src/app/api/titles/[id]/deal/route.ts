import { NextResponse } from "next/server";
import { saveDeal } from "@/modules/deals/service";
import { requireContext } from "@/platform/context";
import { dealSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(dealSchema, await request.json());
    const deal = await saveDeal(ctx, id, input);
    return NextResponse.json({ deal: serialize(ctx.role, "Deal", deal) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
