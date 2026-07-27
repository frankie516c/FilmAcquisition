import { NextResponse } from "next/server";
import { z } from "zod";
import { createComment } from "@/modules/evaluation/service";
import { requireContext } from "@/platform/context";
import { validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

const bodySchema = z.object({
  body: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "내용을 입력해주세요.").max(5000)),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(bodySchema, await request.json());
    const { comment, notified } = await createComment(ctx, id, input.body);
    return NextResponse.json(
      { comment: serialize(ctx.role, "Comment", comment), notified },
      { status: 201 },
    );
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
