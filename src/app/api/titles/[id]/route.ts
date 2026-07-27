import { NextResponse } from "next/server";
import { deleteTitle, updateTitle } from "@/modules/titles/service";
import { requireContext } from "@/platform/context";
import { titleCreateSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(titleCreateSchema.partial(), await request.json());
    const title = await updateTitle(ctx, id, input);
    return NextResponse.json({ title: serialize(ctx.role, "Title", title) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    await deleteTitle(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
