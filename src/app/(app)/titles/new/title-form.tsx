"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GENRES = [
  ["DRAMA", "드라마"], ["THRILLER", "스릴러"], ["COMEDY", "코미디"], ["ACTION", "액션"],
  ["ROMANCE", "로맨스"], ["HORROR", "공포"], ["SF", "SF"], ["FANTASY", "판타지"],
  ["ANIMATION", "애니메이션"], ["DOCUMENTARY", "다큐멘터리"], ["MYSTERY", "미스터리"], ["WAR", "전쟁"],
] as const;

interface Candidate {
  id: string;
  titleKo: string;
  productionYear: number;
  stage: string;
}

export default function TitleForm() {
  const router = useRouter();
  const [titleKo, setTitleKo] = useState("");
  const [titleOriginal, setTitleOriginal] = useState("");
  const [director, setDirector] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [genres, setGenres] = useState<string[]>([]);
  const [synopsis, setSynopsis] = useState("");
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, setPending] = useState(false);

  const issueFor = (p: string) => issues.find((i) => i.path === p)?.message;

  /** 원제 입력이 끝나면 중복 후보를 미리 조회한다 — 차단이 아니라 경고다 */
  async function checkDuplicates() {
    if (!titleOriginal.trim() || !Number.isInteger(Number(year))) return;
    const res = await fetch(
      `/api/titles?titleOriginal=${encodeURIComponent(titleOriginal.trim())}&productionYear=${year}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setCandidates(data.candidates ?? []);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setIssues([]);
    setMessage(null);

    const res = await fetch("/api/titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleKo,
        titleOriginal: titleOriginal || null,
        director: director || null,
        productionYear: Number(year),
        genres,
        synopsis: synopsis || null,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      router.push(`/titles/${data.title.id}`);
      router.refresh();
      return;
    }
    setIssues(data?.error?.fields ?? []);
    setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
    setPending(false);
  }

  return (
    <section className="card">
      <form className="cbody" onSubmit={submit}>
        {message && <div className="errbox" style={{ marginBottom: 12 }}>{message}</div>}

        {candidates.length > 0 && (
          <div className="gapnote" style={{ marginTop: 0, marginBottom: 12 }}>
            <b>중복 가능성</b> — 같은 원제·제작연도의 작품이 {candidates.length}건 있습니다.
            리메이크나 동명이작일 수 있으므로 그대로 등록해도 됩니다.
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {candidates.map((c) => (
                <a key={c.id} href={`/titles/${c.id}`} className="pill p-neut">
                  {c.titleKo} ({c.productionYear})
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="fieldset">
          <label>
            제목 <span style={{ color: "var(--crit)" }}>*</span>
            <input value={titleKo} onChange={(e) => setTitleKo(e.target.value)} required />
            {issueFor("titleKo") && (
              <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
                {issueFor("titleKo")}
              </span>
            )}
          </label>

          <label>
            원제
            <input
              value={titleOriginal}
              onChange={(e) => setTitleOriginal(e.target.value)}
              onBlur={checkDuplicates}
            />
          </label>

          <label>
            감독
            <input value={director} onChange={(e) => setDirector(e.target.value)} />
          </label>

          <label>
            제작연도 <span style={{ color: "var(--crit)" }}>*</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onBlur={checkDuplicates}
              required
            />
            {issueFor("productionYear") && (
              <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
                {issueFor("productionYear")}
              </span>
            )}
          </label>

          <div>
            <span className="lbl">장르 (하나 이상)</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {GENRES.map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  className={`pill ${genres.includes(code) ? "p-acc" : "p-neut"}`}
                  style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                  onClick={() =>
                    setGenres((g) =>
                      g.includes(code) ? g.filter((x) => x !== code) : [...g, code],
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {issueFor("genres") && (
              <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
                {issueFor("genres")}
              </span>
            )}
          </div>

          <label>
            시놉시스
            <input value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="submit" type="submit" disabled={pending} style={{ flex: 1 }}>
            {pending ? "등록 중…" : "등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
