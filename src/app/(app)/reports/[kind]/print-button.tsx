"use client";

export default function PrintButton() {
  return (
    <button className="act" onClick={() => window.print()}>
      인쇄 / PDF로 저장
    </button>
  );
}
