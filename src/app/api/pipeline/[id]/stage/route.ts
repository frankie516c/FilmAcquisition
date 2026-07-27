import { NextResponse } from "next/server";
import { z } from "zod";
import { changeStage } from "@/modules/pipeline/service";
import { requireContext } from "@/platform/context";
import { validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";
import { STAGES } from "@/domain/pipeline-rules";

const bodySchema = z.object({
  toStage: z.enum(STAGES),
  note: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { id } = await params;
    const input = validate(bodySchema, await request.json());
    const title = await changeStage(ctx, id, input.toStage, input.note);
    return NextResponse.json({ title: serialize(ctx.role, "Title", title) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
