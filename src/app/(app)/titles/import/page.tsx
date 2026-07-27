import Link from "next/link";
import { requireContext } from "@/platform/context";
import { canPerform, ROLE_LABELS } from "@/platform/authz/policy";
import ImportPanel from "./import-panel";

export default async function ImportPage() {
  const ctx = await requireContext();

  if (!canPerform(ctx.role, "import:commit")) {
    return (
      <>
        <div className="phead">
          <Link href="/titles" className="act">← 목록</Link>
          <h1>CSV 가져오기</h1>
        </div>
        <div className="locked">
          현재 역할({ROLE_LABELS[ctx.role]})은 <b>import:commit</b> 권한이 없습니다.
          API를 직접 호출해도 403이 반환됩니다.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="phead">
        <Link href="/titles" className="act">← 목록</Link>
        <h1>CSV 가져오기</h1>
        <p>반영 전에 미리보기로 검증 결과를 확인합니다</p>
      </div>
      <ImportPanel />
    </>
  );
}
