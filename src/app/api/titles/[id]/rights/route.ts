import { NextResponse } from "next/server";
import { saveRights } from "@/modules/deals/service";
import { requireContext } from "@/platform/context";
import { rightsGrantSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(rightsGrantSchema, await request.json());
    const rights = await saveRights(ctx, id, input);
    return NextResponse.json({ rights: serialize(ctx.role, "RightsGrant", rights) }, { status: 201 });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
