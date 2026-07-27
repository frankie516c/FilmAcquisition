import { NextResponse } from "next/server";
import { createTitle, findDuplicateCandidates } from "@/modules/titles/service";
import { requireContext } from "@/platform/context";
import { titleCreateSchema, validate } from "@/platform/validation/schemas";
import { toHttpResponse } from "@/platform/errors";
import { serialize } from "@/platform/authz/serialize";

/** 중복 후보 조회 — 등록 화면에서 경고를 띄우기 위한 사전 조회 */
export async function GET(request: Request) {
  try {
    const ctx = await requireContext();
    const url = new URL(request.url);
    const titleOriginal = url.searchParams.get("titleOriginal");
    const year = Number(url.searchParams.get("productionYear"));
    if (!titleOriginal || !Number.isInteger(year)) {
      return NextResponse.json({ candidates: [] });
    }
    const candidates = await findDuplicateCandidates(ctx, titleOriginal, year);
    return NextResponse.json({ candidates: serialize(ctx.role, "Title", candidates) });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireContext();
    const input = validate(titleCreateSchema, await request.json());
    const title = await createTitle(ctx, {
      ...input,
      titleOriginal: input.titleOriginal ?? null,
      director: input.director ?? null,
      synopsis: input.synopsis ?? null,
    });
    return NextResponse.json({ title: serialize(ctx.role, "Title", title) }, { status: 201 });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
