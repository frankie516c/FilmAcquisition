"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CRITERIA = [
  ["artistry", "작품성"],
  ["commerciality", "상업성"],
  ["buzz", "화제성"],
  ["targetFit", "타깃 적합성"],
] as const;

type Key = (typeof CRITERIA)[number][0];

export default function EvaluationForm({ titleId }: { titleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Record<Key, number>>({
    artistry: 3,
    commerciality: 3,
    buzz: 3,
    targetFit: 3,
  });
  const [comment, setComment] = useState("");
  const [venue, setVenue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const average =
    Math.round(
      (CRITERIA.reduce((sum, [k]) => sum + scores[k], 0) / CRITERIA.length) * 10,
    ) / 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const res = await fetch(`/api/titles/${titleId}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...scores,
        overallComment: comment || null,
        screeningVenue: venue || null,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      setMessage("평가를 등록했습니다. 기존 평가는 그대로 보존됩니다.");
      setOpen(false);
      setComment("");
      setVenue("");
      router.refresh();
    } else {
      setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
    }
    setPending(false);
  }

  if (!open) {
    return (
      <div style={{ paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
        {message && (
          <span className="pill p-good" style={{ marginRight: 8 }}>
            {message}
          </span>
        )}
        <button className="act" onClick={() => setOpen(true)}>
          평가 작성
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
      {message && <div className="errbox" style={{ marginBottom: 10 }}>{message}</div>}

      {CRITERIA.map(([key, label]) => (
        <div
          key={key}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}
        >
          <span style={{ width: 84, fontSize: 12.5, color: "var(--ink-2)" }}>{label}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`pill ${scores[key] === n ? "p-acc" : "p-neut"}`}
              style={{ cursor: "pointer", minWidth: 28, justifyContent: "center" }}
              onClick={() => setScores((s) => ({ ...s, [key]: n }))}
            >
              {n}
            </button>
          ))}
        </div>
      ))}

      <div className="kv" style={{ marginTop: 8 }}>
        <span className="k">이 평가의 점수</span>
        <b>{average.toFixed(1)}</b>
      </div>

      <div className="fieldset" style={{ marginTop: 10 }}>
        <label>
          총평
          <input value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <label>
          시사 장소
          <input value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="submit" type="submit" disabled={pending} style={{ flex: 1 }}>
          {pending ? "등록 중…" : "평가 등록"}
        </button>
        <button className="act" type="button" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
    </form>
  );
}
