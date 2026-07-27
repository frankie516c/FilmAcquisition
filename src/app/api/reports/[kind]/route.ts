import { NextResponse } from "next/server";
import { generateReport, REPORT_KINDS, type ReportKind } from "@/modules/dataio/report-service";
import { requireContext } from "@/platform/context";
import { toHttpResponse } from "@/platform/errors";
import { serializeToCsv } from "@/domain/csv";
import { formatDate } from "@/domain/calendar";

type Params = { params: Promise<{ kind: string }> };

/**
 * Excel용 CSV. BOM이 붙으므로 Excel이 UTF-8로 인식해 한글이 정상 표시된다.
 * 여러 섹션을 한 파일에 담기 위해 섹션 제목 행을 사이에 넣는다.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireContext();
    const { kind } = await params;
    if (!REPORT_KINDS.includes(kind as ReportKind)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "리포트 종류가 올바르지 않습니다." } },
        { status: 404 },
      );
    }

    const report = await generateReport(ctx, kind as ReportKind);

    // 섹션마다 컬럼 수가 다르므로 최대 컬럼 수에 맞춰 단일 표로 평탄화한다
    const width = Math.max(...report.sections.map((s) => s.columns.length), 2);
    const columns = Array.from({ length: width }, (_, i) => ({
      key: `c${i}`,
      header: i === 0 ? report.title : "",
    }));

    const rows: Record<string, string>[] = [];
    const pushRow = (cells: string[]) => {
      const row: Record<string, string> = {};
      columns.forEach((c, i) => (row[c.key] = cells[i] ?? ""));
      rows.push(row);
    };

    pushRow([`생성 시각 ${report.generatedAt}`, `생성자 ${report.generatedBy}`]);
    for (const section of report.sections) {
      pushRow([]);
      pushRow([section.heading]);
      pushRow(section.columns);
      section.rows.forEach(pushRow);
    }

    return new NextResponse(serializeToCsv(rows, columns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${kind}-${formatDate(ctx.now)}.csv"`,
      },
    });
  } catch (error) {
    const { status, body } = toHttpResponse(error);
    return NextResponse.json(body, { status });
  }
}
