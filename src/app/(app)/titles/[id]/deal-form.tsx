"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface FieldIssue {
  path: string;
  message: string;
}

export interface DealFormValues {
  askingPrice: string;
  offerAmount: string;
  offerSubmittedAt: string;
  offerExpiryDate: string;
  minimumGuarantee: string;
  runningRoyaltyRate: string;
  contractTerms: string;
}

export interface FinancialFormValues {
  paAndBudget: string;
  otherCosts: string;
  expectedRevenue: string;
}

export default function DealForm({
  titleId,
  deal,
  financials,
}: {
  titleId: string;
  deal: DealFormValues;
  financials: FinancialFormValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(deal);
  const [f, setF] = useState(financials);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /**
   * 서버가 주는 경로는 중첩 스키마 때문에 `deal.minimumGuarantee` 형태다.
   * 폼은 필드명만 알므로 마지막 마디로 매칭한다.
   */
  const issueFor = (field: string) =>
    issues.find((i) => i.path === field || i.path.endsWith(`.${field}`))?.message;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setIssues([]);
    setMessage(null);

    const num = (v: string) => (v.trim() === "" ? null : v.trim());
    const hasFinancials = f.expectedRevenue.trim() !== "" || f.paAndBudget.trim() !== "";

    // 딜과 재무를 한 번의 요청으로 보낸다.
    // 두 요청으로 나누면 딜만 저장되고 재무가 실패하는 중간 상태가 생긴다.
    const res = await fetch(`/api/titles/${titleId}/deal-financials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deal: {
          askingPrice: num(d.askingPrice),
          offerAmount: num(d.offerAmount),
          offerSubmittedAt: num(d.offerSubmittedAt),
          offerExpiryDate: num(d.offerExpiryDate),
          minimumGuarantee: num(d.minimumGuarantee),
          runningRoyaltyRate:
            d.runningRoyaltyRate.trim() === "" ? null : Number(d.runningRoyaltyRate),
          contractTerms: d.contractTerms,
        },
        financials: hasFinancials
          ? {
              paAndBudget: f.paAndBudget.trim() || "0",
              otherCosts: f.otherCosts.trim() || "0",
              expectedRevenue: f.expectedRevenue.trim() || "0",
            }
          : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setIssues(body?.error?.fields ?? []);
      setMessage(`${res.status} ${body?.error?.code ?? ""} — ${body?.error?.message ?? "실패"}`);
      setPending(false);
      return;
    }

    setMessage("저장했습니다.");
    setPending(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="cbody" style={{ borderTop: "1px solid var(--line-2)" }}>
        {message && (
          <span className="pill p-good" style={{ marginRight: 8 }}>
            {message}
          </span>
        )}
        <button className="act" onClick={() => setOpen(true)}>
          딜·재무 편집
        </button>
      </div>
    );
  }

  const field = (
    label: string,
    key: keyof DealFormValues,
    type = "text",
    hint?: string,
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={d[key]}
        onChange={(e) => setD({ ...d, [key]: e.target.value })}
        placeholder={hint}
      />
      {issueFor(key) && (
        <span style={{ color: "var(--crit)", fontSize: 11, fontWeight: 600 }}>
          {issueFor(key)}
        </span>
      )}
    </label>
  );

  return (
    <form className="cbody" style={{ borderTop: "1px solid var(--line-2)" }} onSubmit={save}>
      {message && <div className="errbox" style={{ marginBottom: 12 }}>{message}</div>}

      <div className="lbl" style={{ marginBottom: 8 }}>딜 정보 · 금액은 원 단위 정수</div>
      <div className="fieldset">
        {field("요청가", "askingPrice", "text", "1200000000")}
        {field("오퍼 금액", "offerAmount", "text", "900000000")}
        {field("오퍼 제출일", "offerSubmittedAt", "date")}
        {field("오퍼 유효기간", "offerExpiryDate", "date")}
        {field("MG (최소보증금)", "minimumGuarantee", "text", "800000000")}
        {field("러닝 로열티율 (%)", "runningRoyaltyRate", "text", "12.5")}
        {field("계약 조건", "contractTerms")}
      </div>

      <div className="lbl" style={{ margin: "16px 0 8px" }}>재무 입력</div>
      <div className="fieldset">
        <label>
          P&amp;A 예산
          <input
            value={f.paAndBudget}
            onChange={(e) => setF({ ...f, paAndBudget: e.target.value })}
            placeholder="1400000000"
          />
        </label>
        <label>
          기타 비용
          <input
            value={f.otherCosts}
            onChange={(e) => setF({ ...f, otherCosts: e.target.value })}
            placeholder="200000000"
          />
        </label>
        <label>
          예상 매출
          <input
            value={f.expectedRevenue}
            onChange={(e) => setF({ ...f, expectedRevenue: e.target.value })}
            placeholder="3800000000"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="submit" type="submit" disabled={pending} style={{ flex: 1 }}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button className="act" type="button" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        총 인수비용·손익·ROI는 저장하지 않습니다. 조회 시점에 단일 산식으로 계산됩니다.
      </p>
    </form>
  );
}
