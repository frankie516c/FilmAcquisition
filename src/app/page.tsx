import { redirect } from "next/navigation";

/** 진입점 — 인증 여부는 (app) 레이아웃이 판정한다 */
export default function Home() {
  redirect("/dashboard");
}
