"use client";

import { useState } from "react";

export default function ExportButton({ stage }: { stage?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    setMessage(null);

    const url = `/api/export/titles${stage ? `?stage=${stage}` : ""}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(`${res.status} ${body?.error?.code ?? ""} — ${body?.error?.message ?? "실패"}`);
      setPending(false);
      return;
    }

    // 권한 때문에 빠진 컬럼을 사용자에게 알린다.
    // "왜 내 파일에는 MG 컬럼이 없지?" 를 추측하지 않게 하기 위함이다.
    const omitted = decodeURIComponent(res.headers.get("X-Omitted-Columns") ?? "");
    const rows = res.headers.get("X-Row-Count") ?? "?";

    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download =
      res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "titles.csv";
    a.click();
    URL.revokeObjectURL(href);

    setMessage(
      omitted
        ? `${rows}행 내보냈습니다. 권한이 없어 제외된 컬럼: ${omitted}`
        : `${rows}행 내보냈습니다. 전 컬럼 포함.`,
    );
    setPending(false);
  }

  return (
    <>
      <button className="act" onClick={download} disabled={pending}>
        {pending ? "생성 중…" : "CSV 내보내기"}
      </button>
      {message && (
        <span className="pill p-neut" style={{ marginLeft: 8 }}>
          {message}
        </span>
      )}
    </>
  );
}
