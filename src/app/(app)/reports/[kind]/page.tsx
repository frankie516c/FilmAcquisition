import { notFound } from "next/navigation";
import { requireContext } from "@/platform/context";
import {
  generateReport,
  REPORT_KINDS,
  type ReportKind,
} from "@/modules/dataio/report-service";
import PrintButton from "./print-button";

type Params = Promise<{ kind: string }>;

export default async function ReportPrintPage({ params }: { params: Params }) {
  const { kind } = await params;
  if (!REPORT_KINDS.includes(kind as ReportKind)) notFound();

  const ctx = await requireContext();
  const report = await generateReport(ctx, kind as ReportKind);

  return (
    <>
      <style>{`
        @media print {
          .rail, .top, .no-print { display: none !important; }
          .page { padding: 0 !important; }
          .shell { display: block !important; }
          body { background: #fff; }
          .report { box-shadow: none; border: 0; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        .report h2 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
        .report .meta { color: var(--muted); font-size: 12px; }
        .report section { margin-top: 20px; }
        .report section h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
      `}</style>

      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <PrintButton />
        <span className="note">
          인쇄 대화상자에서 대상을 &ldquo;PDF로 저장&rdquo;으로 선택하세요.
        </span>
      </div>

      <article className="card report">
        <div className="cbody">
          <h2>{report.title}</h2>
          {/* US-025 — 머리말에 생성 시각과 생성자 */}
          <div className="meta">
            생성 시각 {report.generatedAt} · 생성자 {report.generatedBy}
          </div>

          {report.sections.map((s, i) => (
            <section key={i}>
              <h3>{s.heading}</h3>
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr>
                      {s.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.length === 0 && (
                      <tr>
                        <td colSpan={s.columns.length} style={{ color: "var(--faint)" }}>
                          해당 항목이 없습니다.
                        </td>
                      </tr>
                    )}
                    {s.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </article>
    </>
  );
}
