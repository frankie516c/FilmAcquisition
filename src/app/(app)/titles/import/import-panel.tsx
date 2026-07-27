"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Issue {
  rowNumber: number;
  column: string;
  message: string;
}

interface Preview {
  totalRows: number;
  validCount: number;
  issues: Issue[];
  sample: { titleKo: string; productionYear: number; genres: string[] }[];
}

export default function ImportPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(mode?: "ALL" | "VALID_ONLY") {
    if (!file) return;
    setPending(true);
    setMessage(null);

    const form = new FormData();
    form.append("file", file);
    if (mode) form.append("mode", mode);

    const res = await fetch("/api/import/titles", { method: "POST", body: form });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
      setPending(false);
      return;
    }

    if (mode) {
      setMessage(`${data.imported}건 반영, ${data.skipped}건 제외했습니다.`);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else {
      setPreview(data);
    }
    setPending(false);
  }

  return (
    <section className="card">
      <div className="cbody">
        {message && (
          <div className={message.startsWith("4") || message.startsWith("5") ? "errbox" : "gapnote"} style={{ marginTop: 0, marginBottom: 12 }}>
            {message}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <a className="act" href="/api/import/titles" download>
            템플릿 다운로드
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setMessage(null);
            }}
            style={{ fontSize: 12.5 }}
          />
          <button className="act" onClick={() => void send()} disabled={!file || pending}>
            {pending ? "확인 중…" : "미리보기"}
          </button>
        </div>

        <p className="note" style={{ marginTop: 10 }}>
          장르는 <span className="mono">드라마;스릴러</span> 처럼 세미콜론으로 구분합니다.
          미리보기 단계에서는 아무것도 저장되지 않습니다.
        </p>
      </div>

      {preview && (
        <>
          <div className="cbody" style={{ borderTop: "1px solid var(--line-2)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill p-neut">전체 {preview.totalRows}행</span>
              <span className="pill p-good">정상 {preview.validCount}행</span>
              {preview.issues.length > 0 && (
                <span className="pill p-crit">오류 {preview.issues.length}건</span>
              )}
            </div>
          </div>

          {preview.issues.length > 0 && (
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>행</th>
                    <th>컬럼</th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.issues.map((i, idx) => (
                    <tr key={idx}>
                      <td>
                        <b>{i.rowNumber}</b>
                      </td>
                      <td>{i.column}</td>
                      <td style={{ color: "var(--crit)" }}>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.sample.length > 0 && (
            <div className="cbody" style={{ borderTop: "1px solid var(--line-2)" }}>
              <span className="lbl">반영될 작품 (최대 5건 미리보기)</span>
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {preview.sample.map((s, i) => (
                  <span key={i} className="pill p-acc">
                    {s.titleKo} ({s.productionYear})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div
            className="cbody"
            style={{ borderTop: "1px solid var(--line-2)", display: "flex", gap: 8 }}
          >
            <button
              className="submit"
              onClick={() => void send("VALID_ONLY")}
              disabled={pending || preview.validCount === 0}
              style={{ flex: 1 }}
            >
              정상 {preview.validCount}행만 반영
            </button>
            <button
              className="act"
              onClick={() => void send("ALL")}
              disabled={pending || preview.issues.length > 0}
              title={preview.issues.length > 0 ? "오류 행이 있어 전체 반영할 수 없습니다" : ""}
            >
              전체 반영
            </button>
          </div>
        </>
      )}
    </section>
  );
}
