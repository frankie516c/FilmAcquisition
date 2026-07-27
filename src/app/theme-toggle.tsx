"use client";

import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "fad-theme";

const NEXT: Record<ThemePref, ThemePref> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemePref, string> = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
};

const ICON: Record<ThemePref, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/** 저장된 선택을 실제 테마로 환산해 <html>에 반영한다 */
function apply(pref: ThemePref): void {
  const resolved =
    pref === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : pref;
  document.documentElement.dataset.theme = resolved;
}

/**
 * 테마 전환 — 시스템 → 라이트 → 다크 순환.
 *
 * 첫 페인트의 테마는 이 컴포넌트가 아니라 layout.tsx의 인라인 스크립트가 정한다.
 * 여기서 정하면 React가 마운트되기 전 한 프레임 동안 잘못된 테마가 번쩍인다.
 */
export default function ThemeToggle() {
  // 서버에는 localStorage가 없다. 마운트 전에는 무엇이 선택됐는지 알 수 없으므로
  // null로 두고, 확정된 뒤에만 라벨을 그린다.
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    setPref(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  // 시스템을 따르는 동안에는 OS 설정 변경을 실시간으로 반영한다
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function cycle() {
    if (pref === null) return;
    const next = NEXT[pref];
    setPref(next);
    if (next === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
    apply(next);
  }

  return (
    <button
      className="act themebtn"
      type="button"
      onClick={cycle}
      // 마운트 전에는 무엇이 선택됐는지 모르므로 조작 대상에서 뺀다
      disabled={pref === null}
      aria-label={
        pref === null ? "테마 전환" : `테마 전환 — 현재 ${LABEL[pref]}, 누르면 ${LABEL[NEXT[pref]]}`
      }
      title="테마 전환 (시스템 → 라이트 → 다크)"
    >
      <span aria-hidden="true">{pref === null ? "◐" : ICON[pref]}</span>
      <span className="themelabel">{pref === null ? "테마" : LABEL[pref]}</span>
    </button>
  );
}
