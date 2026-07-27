import Link from "next/link";
import { requireContext } from "@/platform/context";
import { canPerform, ROLE_LABELS } from "@/platform/authz/policy";
import TitleForm from "./title-form";

export default async function NewTitlePage() {
  const ctx = await requireContext();

  if (!canPerform(ctx.role, "title:write")) {
    return (
      <>
        <div className="phead">
          <Link href="/titles" className="act">← 목록</Link>
          <h1>작품 등록</h1>
        </div>
        <div className="locked">
          현재 역할({ROLE_LABELS[ctx.role]})은 <b>title:write</b> 권한이 없습니다.
          작품 등록·수정·삭제는 스카우트만 가능합니다. API를 직접 호출해도 403이 반환됩니다.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="phead">
        <Link href="/titles" className="act">← 목록</Link>
        <h1>작품 등록</h1>
        <p>등록하면 <b>발굴</b> 단계로 시작하고 최초 이력이 함께 기록됩니다</p>
      </div>
      <TitleForm />
    </>
  );
}
