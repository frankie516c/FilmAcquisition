"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  type: "MENTION" | "OFFER_EXPIRY" | "RIGHTS_EXPIRY";
  message: string;
  marker: string;
  isRead: boolean;
  createdAt: string;
  title?: { id: string; titleKo: string } | null;
}

const ICON: Record<Notification["type"], string> = {
  MENTION: "💬",
  OFFER_EXPIRY: "⏳",
  RIGHTS_EXPIRY: "📄",
};

export default function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    })();
  }, [open]);

  async function markAll() {
    const res = await fetch("/api/notifications", { method: "POST" });
    if (res.ok) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      router.refresh();
    }
  }

  async function scan() {
    setScanMsg("스캔 중…");
    const res = await fetch("/api/notifications/scan", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setScanMsg(`생성 ${data.created}건 · 중복으로 건너뜀 ${data.skipped}건`);
      const list = await (await fetch("/api/notifications")).json();
      setItems(list.notifications ?? []);
      setUnread(list.unread ?? 0);
      router.refresh();
    } else {
      setScanMsg(`${res.status} ${data?.error?.message ?? "실패"}`);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="act"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ position: "relative", padding: "6px 10px" }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              background: "var(--crit)",
              color: "#fff",
              fontSize: 10,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              padding: "0 4px",
              fontWeight: 700,
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            width: "min(380px, 88vw)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            boxShadow: "var(--shadow)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 13px",
              borderBottom: "1px solid var(--line-2)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <b style={{ fontSize: 12.5 }}>알림</b>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button className="act" onClick={scan}>
                마감 스캔
              </button>
              <button className="act" onClick={markAll} disabled={unread === 0}>
                전체 읽음
              </button>
            </span>
          </div>

          {scanMsg && (
            <div className="cbody" style={{ padding: "8px 13px", borderBottom: "1px solid var(--line-2)" }}>
              <span className="pill p-neut">{scanMsg}</span>
            </div>
          )}

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {items.length === 0 && (
              <div style={{ padding: "16px 13px" }}>
                <p className="note" style={{ margin: 0 }}>
                  알림이 없습니다. &ldquo;마감 스캔&rdquo;을 눌러보세요.
                </p>
              </div>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "10px 13px",
                  borderBottom: "1px solid var(--line-2)",
                  display: "flex",
                  gap: 9,
                  background: n.isRead ? "transparent" : "var(--accent-soft)",
                }}
              >
                <span>{ICON[n.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.title ? (
                    <Link href={`/titles/${n.title.id}`} onClick={() => setOpen(false)}>
                      <b style={{ fontSize: 12.5, display: "block" }}>{n.message}</b>
                    </Link>
                  ) : (
                    <b style={{ fontSize: 12.5, display: "block" }}>{n.message}</b>
                  )}
                  <span style={{ color: "var(--faint)", fontSize: 11 }}>
                    {n.createdAt.slice(0, 10)} · {n.marker.length > 8 ? "멘션" : n.marker}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
