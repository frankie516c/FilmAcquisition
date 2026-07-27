import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Acquisition Dashboard",
  description: "영화 판권 인수 파이프라인·평가·수익성·마감 통합 관리",
};

/**
 * 첫 페인트 이전에 테마를 확정한다.
 *
 * React가 마운트된 뒤에 정하면 한 프레임 동안 잘못된 테마가 번쩍인다(FOUC).
 * 그래서 렌더 차단 인라인 스크립트로 <html data-theme>을 먼저 박아 넣는다.
 *
 * CSS의 다크 팔레트는 미디어 쿼리가 아니라 [data-theme="dark"]로 걸려 있으므로
 * 이 스크립트가 실패하면 라이트로 떨어진다 — 읽을 수 없는 화면이 되지 않는 쪽이다.
 */
const THEME_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('fad-theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 스크립트가 data-theme을 넣으므로 서버 HTML과 달라진다. 의도된 차이다.
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
