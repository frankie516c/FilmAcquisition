"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CommentForm({
  titleId,
  memberNames,
}: {
  titleId: string;
  memberNames: string[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const res = await fetch(`/api/titles/${titleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      setBody("");
      setMessage(
        data.notified > 0
          ? `등록했습니다. 멘션 알림 ${data.notified}건이 생성되었습니다.`
          : "등록했습니다.",
      );
      router.refresh();
    } else {
      setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} style={{ padding: "10px 0 0", borderTop: "1px solid var(--line-2)" }}>
      {message && (
        <span className="pill p-neut" style={{ marginBottom: 8, display: "inline-flex" }}>
          {message}
        </span>
      )}
      <label>
        코멘트
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="@이분석 조건 확인 부탁드려요"
          maxLength={5000}
        />
      </label>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <button className="act" type="submit" disabled={pending || body.trim() === ""}>
          {pending ? "등록 중…" : "등록"}
        </button>
        <span className="note">@ 로 멘션:</span>
        {memberNames.map((n) => (
          <button
            key={n}
            type="button"
            className="pill p-acc"
            style={{ border: "1px solid var(--accent-line)", cursor: "pointer" }}
            onClick={() => setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${n} `)}
          >
            @{n}
          </button>
        ))}
      </div>
    </form>
  );
}
