"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS, type Role } from "@/platform/authz/policy";

interface Row {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const ROLES: Role[] = ["SCOUT", "ANALYST", "EXECUTIVE"];

export default function UserTable({
  users,
  executiveCount,
  currentUserId,
}: {
  users: Row[];
  executiveCount: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(label: string, request: () => Promise<Response>) {
    setPending(label);
    const res = await request();
    if (res.ok) {
      setMessage("처리했습니다.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      // 마지막 경영진 보호는 여기서 409 LAST_EXECUTIVE로 돌아온다
      setMessage(`${res.status} ${body?.error?.code ?? ""} — ${body?.error?.message ?? "실패"}`);
    }
    setPending(null);
    setTimeout(() => setMessage(null), 4000);
  }

  const changeRole = (id: string, role: Role) =>
    run(`${id}:${role}`, () =>
      fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    );

  const remove = (id: string) =>
    run(`${id}:del`, () => fetch(`/api/users/${id}`, { method: "DELETE" }));

  return (
    <section className="card">
      {message && (
        <div className="cbody" style={{ borderBottom: "1px solid var(--line-2)" }}>
          <span className="pill p-warn">{message}</span>
        </div>
      )}

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isLastExecutive = u.role === "EXECUTIVE" && executiveCount === 1;
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.name}</b>
                    {u.id === currentUserId && (
                      <span className="pill p-neut" style={{ marginLeft: 6 }}>
                        나
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {u.email}
                  </td>
                  <td>
                    <span className={`pill ${u.role === "EXECUTIVE" ? "p-acc" : "p-neut"}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {ROLES.filter((r) => r !== u.role).map((r) => (
                      <button
                        key={r}
                        className="act"
                        style={{ marginLeft: 4 }}
                        disabled={isLastExecutive || pending !== null}
                        onClick={() => void changeRole(u.id, r)}
                      >
                        {ROLE_LABELS[r]}로
                      </button>
                    ))}
                    <button
                      className="act"
                      style={{ marginLeft: 4 }}
                      disabled={isLastExecutive || pending !== null}
                      onClick={() => void remove(u.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cbody" style={{ borderTop: "1px solid var(--line-2)" }}>
        <p className="note">
          {executiveCount === 1 ? (
            <>
              <b>마지막 경영진 보호가 활성화되어 있습니다.</b> 남은 경영진 1명의 역할 변경·삭제
              버튼이 비활성화되었고, API를 직접 호출해도 409{" "}
              <span className="mono">LAST_EXECUTIVE</span>가 반환됩니다. 버튼 비활성화는 편의일
              뿐이며 실제 차단은 서버 트랜잭션 안에서 이뤄집니다.
            </>
          ) : (
            <>
              경영진이 {executiveCount}명이므로 역할 변경·삭제가 정상 처리됩니다. 1명이 될 때까지
              줄여보면 보호 규칙이 작동합니다.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
