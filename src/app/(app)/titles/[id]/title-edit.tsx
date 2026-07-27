"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const GENRES = [
  ["DRAMA", "드라마"], ["THRILLER", "스릴러"], ["COMEDY", "코미디"], ["ACTION", "액션"],
  ["ROMANCE", "로맨스"], ["HORROR", "공포"], ["SF", "SF"], ["FANTASY", "판타지"],
  ["ANIMATION", "애니메이션"], ["DOCUMENTARY", "다큐멘터리"], ["MYSTERY", "미스터리"], ["WAR", "전쟁"],
] as const;

export interface TitleEditValues {
  titleKo: string;
  titleOriginal: string;
  director: string;
  productionYear: string;
  genres: string[];
  synopsis: string;
}

export default function TitleEdit({
  titleId,
  initial,
  hasChildren,
}: {
  titleId: string;
  initial: TitleEditValues;
  /** 평가·코멘트·딜 등 하위 데이터가 있는지 — 삭제 경고에 쓴다 */
  hasChildren: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const issueFor = (p: string) => issues.find((i) => i.path === p)?.message;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setIssues([]);
    setMessage(null);

    const res = await fetch(`/api/titles/${titleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleKo: v.titleKo,
        titleOriginal: v.titleOriginal || null,
        director: v.director || null,
        productionYear: Number(v.productionYear),
        genres: v.genres,
        synopsis: v.synopsis || null,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      setMessage("수정했습니다.");
      setOpen(false);
      router.refresh();
    } else {
      setIssues(data?.error?.fields ?? []);
      setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
    }
    setPending(false);
  }

  async function remove() {
    setPending(true);
    const res = await fetch(`/api/titles/${titleId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/titles");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setMessage(`${res.status} ${data?.error?.message ?? "삭제 실패"}`);
    setPending(false);
    setConfirmDelete(false);
  }

  if (!open) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {message && <span className="pill p-good">{message}</span>}
        <button className="act" onClick={() => setOpen(true)}>
          작품 정보 수정
        </button>

        {!confirmDelete ? (
          <button className="act" onClick={() => setConfirmDelete(true)}>
            삭제
          </button>
        ) : (
          <>
            <span className="pill p-crit">
              {hasChildren
                ? "평가·코멘트·이력·딜이 함께 삭제됩니다. 되돌릴 수 없습니다."
                : "되돌릴 수 없습니다."}
            </span>
            <button className="act" onClick={remove} disabled={pending}>
              {pending ? "삭제 중…" : "정말 삭제"}
            </button>
            <button className="act" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} style={{ width: "100%" }}>
      {message && <div className="errbox" style={{ marginBottom: 12 }}>{message}</div>}

      <div className="fieldset">
        <label>
          제목
          <input value={v.titleKo} onChange={(e) => setV({ ...v, titleKo: e.target.value })} required />
          {issueFor("titleKo") && (
            <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
              {issueFor("titleKo")}
            </span>
          )}
        </label>
        <label>
          원제
          <input
            value={v.titleOriginal}
            onChange={(e) => setV({ ...v, titleOriginal: e.target.value })}
          />
        </label>
        <label>
          감독
          <input value={v.director} onChange={(e) => setV({ ...v, director: e.target.value })} />
        </label>
        <label>
          제작연도
          <input
            value={v.productionYear}
            onChange={(e) => setV({ ...v, productionYear: e.target.value })}
            required
          />
          {issueFor("productionYear") && (
            <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
              {issueFor("productionYear")}
            </span>
          )}
        </label>

        <div>
          <span className="lbl">장르</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {GENRES.map(([code, label]) => (
              <button
                key={code}
                type="button"
                className={`pill ${v.genres.includes(code) ? "p-acc" : "p-neut"}`}
                style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                onClick={() =>
                  setV((s) => ({
                    ...s,
                    genres: s.genres.includes(code)
                      ? s.genres.filter((x) => x !== code)
                      : [...s.genres, code],
                  }))
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
          <input value={v.synopsis} onChange={(e) => setV({ ...v, synopsis: e.target.value })} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="submit" type="submit" disabled={pending} style={{ flex: 1 }}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button className="act" type="button" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        파이프라인 단계는 여기서 바꿀 수 없습니다. 이력이 남지 않는 경로를 만들지 않기 위해
        단계 변경은 칸반 보드에서만 가능합니다.
      </p>
    </form>
  );
}
