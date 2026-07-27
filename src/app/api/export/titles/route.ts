import { exportTitles } from "@/modules/dataio/export-service";
import { requireContext } from "@/platform/context";
import { toHttpResponse } from "@/platform/errors";
import { STAGES, type Stage } from "@/domain/pipeline-rules";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const ctx = await requireContext();
    const url = new URL(request.url);
    const stageParam = url.searchParams.get("stage");
    const stage = STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : undefined;

    const result = await exportTitles(ctx, { stage, q: url.searchParams.get("q") ?? undefined });

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        // 어떤 컬럼이 권한 때문에 빠졌는지 클라이언트가 안내할 수 있게 한다
        "X-Omitted-Columns": encodeURIComponent(result.omittedColumns.join(",")),
        "X-Row-Count": String(result.rowCount),
      },
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
