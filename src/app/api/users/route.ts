import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/modules/auth/service";
import { requireContext } from "@/platform/context";
import { userCreateSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

export async function GET() {
  try {
    const ctx = await requireContext();
    const users = await listUsers(ctx);
    return NextResponse.json({ users: serialize(ctx.role, "User", users) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireContext();
    const input = validate(userCreateSchema, await request.json());
    const user = await createUser(ctx, input);
    return NextResponse.json({ user: serialize(ctx.role, "User", user) }, { status: 201 });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
