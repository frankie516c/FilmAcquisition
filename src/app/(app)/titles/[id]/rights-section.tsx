"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TERRITORIES = [
  ["KR", "대한민국"], ["US", "미국"], ["JP", "일본"], ["CN", "중국"], ["FR", "프랑스"],
  ["GB", "영국"], ["DE", "독일"], ["IN", "인도"], ["BR", "브라질"],
  ["ASIA", "아시아"], ["EUROPE", "유럽"], ["NORTH_AMERICA", "북미"],
  ["LATIN_AMERICA", "중남미"], ["WORLDWIDE", "전세계"],
] as const;

const LABEL = Object.fromEntries(TERRITORIES) as Record<string, string>;

export interface RightsRow {
  id: string;
  territories: string[];
  contractStartDate: string;
  contractEndDate: string;
  dDay: number;
}

export default function RightsSection({
  titleId,
  rights,
  canEdit,
}: {
  titleId: string;
  rights: RightsRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const issueFor = (p: string) => issues.find((i) => i.path === p)?.message;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setIssues([]);
    setMessage(null);

    const res = await fetch(`/api/titles/${titleId}/rights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        territories: selected,
        contractStartDate: start,
        contractEndDate: end,
      }),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) {
      setMessage("판권을 등록했습니다.");
      setOpen(false);
      setSelected([]);
      setStart("");
      setEnd("");
      router.refresh();
    } else {
      setIssues(data?.error?.fields ?? []);
      setMessage(`${res.status} ${data?.error?.code ?? ""} — ${data?.error?.message ?? "실패"}`);
    }
    setPending(false);
  }

  return (
    <section className="card">
      <header>
        <h3>판권</h3>
        <span className="lbl">{rights.length}건</span>
      </header>

      <div className="cbody">
        {rights.length === 0 && <p className="note">등록된 판권이 없습니다.</p>}

        {rights.map((r) => (
          <div className="field" key={r.id}>
            <span className="fk">
              {r.territories.map((t) => LABEL[t] ?? t).join(" · ")}
            </span>
            <span className="fv">
              {r.contractStartDate} ~ {r.contractEndDate}
              <span
                className={`pill ${r.dDay < 0 ? "p-crit" : r.dDay <= 30 ? "p-warn" : "p-neut"}`}
                style={{ marginLeft: 6 }}
              >
                {r.dDay < 0 ? `${-r.dDay}일 경과` : `D-${r.dDay}`}
              </span>
            </span>
          </div>
        ))}

        {rights.length > 1 && (
          <p className="note" style={{ marginTop: 8 }}>
            영토나 기간이 겹쳐도 저장됩니다. 권리 충돌 검증은 이번 범위에 포함되지 않습니다.
          </p>
        )}
      </div>

      {canEdit && !open && (
        <div className="cbody" style={{ borderTop: "1px solid var(--line-2)" }}>
          {message && (
            <span className="pill p-good" style={{ marginRight: 8 }}>
              {message}
            </span>
          )}
          <button className="act" onClick={() => setOpen(true)}>
            판권 추가
          </button>
        </div>
      )}

      {canEdit && open && (
        <form className="cbody" style={{ borderTop: "1px solid var(--line-2)" }} onSubmit={submit}>
          {message && <div className="errbox" style={{ marginBottom: 12 }}>{message}</div>}

          <span className="lbl">영토 (하나 이상)</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 4px" }}>
            {TERRITORIES.map(([code, label]) => (
              <button
                key={code}
                type="button"
                className={`pill ${selected.includes(code) ? "p-acc" : "p-neut"}`}
                style={{ cursor: "pointer", border: "1px solid var(--line)" }}
                onClick={() =>
                  setSelected((s) =>
                    s.includes(code) ? s.filter((x) => x !== code) : [...s, code],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          {issueFor("territories") && (
            <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
              {issueFor("territories")}
            </span>
          )}

          <div className="fieldset" style={{ marginTop: 12 }}>
            <label>
              계약 시작일
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label>
              계약 종료일
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
              {issueFor("contractEndDate") && (
                <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
                  {issueFor("contractEndDate")}
                </span>
              )}
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              className="submit"
              type="submit"
              disabled={pending || selected.length === 0}
              style={{ flex: 1 }}
            >
              {pending ? "등록 중…" : "판권 등록"}
            </button>
            <button className="act" type="button" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            종료일은 시작일보다 <b>이후</b>여야 합니다. 같은 날짜는 거부됩니다 — 기간이 0일인
            판권은 의미가 없기 때문입니다.
          </p>
        </form>
      )}
    </section>
  );
}
