import { NextResponse } from "next/server";
import { commitImport, getTemplate, previewImport } from "@/modules/dataio/import-service";
import { requireContext } from "@/platform/context";
import { toHttpResponse } from "@/platform/errors";

/** 템플릿 다운로드 */
export async function GET() {
  try {
    await requireContext();
    const template = getTemplate();
    return new NextResponse(template.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${template.filename}"`,
      },
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * 미리보기 또는 반영.
 * mode 없이 호출하면 미리보기 — 아무것도 저장하지 않는다.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireContext();
    const form = await request.formData();
    const file = form.get("file");
    const mode = form.get("mode");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "CSV 파일을 선택해주세요." } },
        { status: 400 },
      );
    }

    const content = await file.text();

    if (mode === "ALL" || mode === "VALID_ONLY") {
      const result = await commitImport(ctx, content, mode);
      return NextResponse.json(result);
    }

    const preview = previewImport(ctx, content);
    return NextResponse.json({
      totalRows: preview.totalRows,
      validCount: preview.validRows.length,
      issues: preview.issues,
      sample: preview.validRows.slice(0, 5),
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
