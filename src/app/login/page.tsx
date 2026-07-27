"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../theme-toggle";

const DEMO = [
  { email: "scout1@fad.local", name: "김스카우트", role: "Scout", hint: "오퍼 금액까지만 보입니다" },
  { email: "analyst@fad.local", name: "이분석", role: "Analyst", hint: "딜·재무 전체 편집" },
  { email: "exec1@fad.local", name: "최경영", role: "Executive", hint: "전체 조회 + 사용자 관리" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => null);
    // 계정 존재 여부를 구분하지 않는 동일한 메시지가 서버에서 온다 (BR-U1-002)
    setError(body?.error?.message ?? "로그인하지 못했습니다.");
    setPending(false);
  }

  return (
    <main className="login-wrap">
      <div className="login">
        {/* 로그인 화면에도 둔다 — 여기가 첫 화면인데 여기서만 테마를 못 바꾸면
            "버튼이 없다"로 읽힌다 */}
        <div className="login-theme">
          <ThemeToggle />
        </div>
        <h1>Film Acquisition Dashboard</h1>
        <p className="sub">계정으로 로그인하세요</p>

        <form className="fieldset" onSubmit={submit}>
          {error && <div className="errbox">{error}</div>}
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="submit" type="submit" disabled={pending}>
            {pending ? "확인 중…" : "로그인"}
          </button>
        </form>

        <div className="demo">
          <span className="lbl">데모 계정 — 클릭하면 이메일이 채워집니다</span>
          {DEMO.map((d) => (
            <button key={d.email} type="button" onClick={() => setEmail(d.email)}>
              <b>
                {d.name} · {d.role}
              </b>
              <span>
                {d.email} — {d.hint}
              </span>
            </button>
          ))}
          <p className="note" style={{ marginTop: 12 }}>
            비밀번호는 <span className="mono">.env</span>의 <span className="mono">SEED_PASSWORD</span>
            {" "}(기본값 <span className="mono">demo1234</span>)입니다. 로컬 PoC 전용 공개 값입니다.
          </p>
        </div>
      </div>
    </main>
  );
}
