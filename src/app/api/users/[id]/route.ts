import { NextResponse } from "next/server";
import { changeRole, deleteUser } from "@/modules/auth/service";
import { requireContext } from "@/platform/context";
import { userRoleUpdateSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(userRoleUpdateSchema, await request.json());
    const user = await changeRole(ctx, id, input.role);
    return NextResponse.json({ user: serialize(ctx.role, "User", user) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    await deleteUser(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
