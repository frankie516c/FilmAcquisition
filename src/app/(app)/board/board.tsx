"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGES, getStageLabel, type Stage } from "@/domain/pipeline-rules";
import type { BoardColumn } from "./page";

/**
 * 확정 대기 중인 이동.
 *
 * 이동을 즉시 기록하지 않고 이 상태를 거치는 이유: 이력은 append-only여서
 * 기록된 뒤에는 사유를 붙일 수 없다. 사유는 기록 **이전**에 받아야 한다.
 */
interface PendingMove {
  titleId: string;
  titleKo: string;
  fromStage: Stage;
  toStage: Stage;
}

export default function Board({
  columns,
  editable,
}: {
  columns: BoardColumn[];
  editable: boolean;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [note, setNote] = useState("");

  /** 드래그와 셀렉트가 공유하는 단일 진입점 — 두 입력 방식이 같은 경로를 타야 한다 */
  function requestMove(move: PendingMove) {
    if (move.toStage === move.fromStage) return;
    setNote("");
    setPending(move);
  }

  function cancel() {
    setPending(null);
    setNote("");
  }

  async function commit() {
    if (!pending) return;
    const { titleId, titleKo, fromStage, toStage } = pending;
    setBusyId(titleId);

    const trimmed = note.trim();
    const res = await fetch(`/api/pipeline/${titleId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 빈 사유는 아예 보내지 않는다 — 서버가 null로 저장하게 둔다
      body: JSON.stringify(trimmed ? { toStage, note: trimmed } : { toStage }),
    });

    if (res.ok) {
      setMessage(
        `«${titleKo}» ${getStageLabel(fromStage)} → ${getStageLabel(toStage)} · 이력이 추가되었습니다 (수정·삭제 불가)`,
      );
      setPending(null);
      setNote("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setMessage(`${res.status} ${body?.error?.code ?? ""} — ${body?.error?.message ?? "실패"}`);
    }
    setBusyId(null);
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <>
      {/* 스크린 리더가 결과를 읽도록 role="status" */}
      {message && (
        <div className="locked" role="status" aria-live="polite">
          {message}
        </div>
      )}

      {pending && (
        <form
          className="movebox"
          onSubmit={(e) => {
            e.preventDefault();
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
        >
          <p className="mv-head">
            <b>{pending.titleKo}</b>
            <span className="mv-arrow">
              {getStageLabel(pending.fromStage)} → {getStageLabel(pending.toStage)}
            </span>
          </p>

          <label className="mv-label" htmlFor="stage-note">
            변경 사유 <span className="mv-opt">(선택)</span>
          </label>
          <textarea
            id="stage-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            autoFocus
            placeholder="예: 세일즈 미팅 후 오퍼 준비 착수"
          />

          <div className="mv-actions">
            <button className="submit" type="submit" disabled={busyId === pending.titleId}>
              {busyId === pending.titleId ? "기록 중…" : "이동 기록"}
            </button>
            <button className="act" type="button" onClick={cancel}>
              취소
            </button>
            <span className="mv-hint">
              기록하면 수정·삭제할 수 없습니다. 사유는 지금만 남길 수 있습니다.
            </span>
          </div>
        </form>
      )}

      <div className="board">
        {columns.map((col) => (
          <div
            key={col.stage}
            className={`col${over === col.stage ? " over" : ""}`}
            onDragOver={(e) => {
              if (!editable) return;
              e.preventDefault();
              setOver(col.stage);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              if (!editable || !dragId) return;
              e.preventDefault();
              setOver(null);
              const card = columns.flatMap((c) =>
                c.cards.map((x) => ({ ...x, stage: c.stage })),
              ).find((x) => x.id === dragId);
              setDragId(null);
              if (card) {
                requestMove({
                  titleId: card.id,
                  titleKo: card.titleKo,
                  fromStage: card.stage,
                  toStage: col.stage,
                });
              }
            }}
          >
            <header>
              <div className="n">
                <b>{col.label}</b>
                <span className="c">{col.cards.length}</span>
              </div>
              <div className="sum">{col.hasOffers ? col.offerTotal : "오퍼 없음"}</div>
            </header>

            <div className="list">
              {col.cards.map((card) => (
                <article
                  key={card.id}
                  className={`tcard${editable ? " draggable" : ""}`}
                  draggable={editable}
                  onDragStart={() => setDragId(card.id)}
                >
                  <Link href={`/titles/${card.id}`}>
                    <b>{card.titleKo}</b>
                  </Link>

                  <div className="m">
                    <span>{card.assignee}</span>
                    {card.score !== null ? (
                      <span className="sc">{card.score.toFixed(1)}</span>
                    ) : (
                      <span style={{ marginLeft: "auto" }}>미평가</span>
                    )}
                  </div>

                  {/* 키보드·스크린 리더용 단계 변경 (NFR-009).
                      드래그는 마우스 전용이므로 이것이 없으면 키보드만으로는 조작이 불가능하다.
                      선택 후에도 즉시 기록하지 않고 드래그와 동일하게 사유 입력을 거친다. */}
                  {editable && (
                    <label className="stage-move">
                      <span className="sr-only">{card.titleKo} 단계 변경</span>
                      <select
                        value={col.stage}
                        disabled={busyId === card.id}
                        onChange={(e) =>
                          requestMove({
                            titleId: card.id,
                            titleKo: card.titleKo,
                            fromStage: col.stage,
                            toStage: e.target.value as Stage,
                          })
                        }
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {getStageLabel(s)}
                            {s === col.stage ? " (현재)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <p className="note">
          카드를 드래그하거나, 카드 안의 단계 선택 상자를 키보드로 조작해 옮길 수 있습니다.
          두 방법 모두 사유 입력을 거쳐 동일하게 이력이 기록됩니다.
        </p>
      )}
    </>
  );
}
