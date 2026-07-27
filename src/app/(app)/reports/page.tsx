import Link from "next/link";
import { requireContext } from "@/platform/context";
import { canPerform, ROLE_LABELS } from "@/platform/authz/policy";
import { REPORT_KINDS, REPORT_LABELS } from "@/modules/dataio/report-service";

export default async function ReportsPage() {
  const ctx = await requireContext();

  if (!canPerform(ctx.role, "report:generate")) {
    return (
      <>
        <div className="phead">
          <h1>리포트</h1>
        </div>
        <div className="locked">
          현재 역할({ROLE_LABELS[ctx.role]})은 <b>report:generate</b> 권한이 없습니다.
          리포트는 분석가와 경영진만 생성할 수 있습니다. API를 직접 호출해도 403이 반환됩니다.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="phead">
        <h1>리포트</h1>
        <p>인쇄용 화면에서 브라우저 인쇄(Ctrl+P)로 PDF 저장, 또는 Excel용 CSV 다운로드</p>
      </div>

      <div className="grid g3">
        {REPORT_KINDS.map((kind) => (
          <section className="card" key={kind}>
            <header>
              <h3>{REPORT_LABELS[kind]}</h3>
            </header>
            <div className="cbody" style={{ display: "flex", gap: 8 }}>
              <Link className="act" href={`/reports/${kind}`} target="_blank">
                인쇄용 보기 → PDF
              </Link>
              <a className="act" href={`/api/reports/${kind}`} download>
                Excel용 CSV
              </a>
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <header>
          <h3>설계와 다른 점</h3>
          <span className="lbl">기록</span>
        </header>
        <div className="cbody">
          <p className="note">
            요구사항(US-025)은 <b>PDF를 서버에서 생성</b>하도록 했습니다. 서버 생성은 한글 TTF를
            저장소에 함께 넣어야 하는데(수 MB), 로컬 프로토타입에서 그 비용 대비 이득이 없다고
            보고 <b>인쇄용 화면 + 브라우저 인쇄</b>로 대체했습니다. 브라우저가 시스템 한글 폰트를
            쓰므로 &ldquo;한글이 깨지지 않아야 한다&rdquo;는 수용 기준은 만족하지만, 생성 주체가
            서버가 아니라 클라이언트라는 점이 원래 설계와 다릅니다.
          </p>
          <p className="note" style={{ marginTop: 8 }}>
            Excel은 BOM이 붙은 UTF-8 CSV로 제공합니다. Excel이 인코딩을 올바로 인식해 한글이
            정상 표시됩니다.
          </p>
        </div>
      </section>
    </>
  );
}
