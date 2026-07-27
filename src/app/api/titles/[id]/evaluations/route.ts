import { NextResponse } from "next/server";
import { createEvaluation } from "@/modules/evaluation/service";
import { requireContext } from "@/platform/context";
import { evaluationSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(evaluationSchema, await request.json());
    const evaluation = await createEvaluation(ctx, id, input);
    return NextResponse.json(
      { evaluation: serialize(ctx.role, "Evaluation", evaluation) },
      { status: 201 },
    );
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
