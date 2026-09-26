/**
 * /start 레이아웃 — pass-through (앱/웹 완벽분리, 트랙B B1b).
 *
 * /start 페이지가 직접 WebChrome 를 렌더하므로 레이아웃은 chrome 을 강제하지
 * 않는다. 루트 AuthAwareShell 을 무력화해 PWA(앱)에서 AppChrome 가 WebChrome 를
 * 이중 래핑하는 것을 막는다 — /partners·/brand·/science 와 동일한 웹 마케팅
 * 라우트 규칙.
 */
export default function StartLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 인앱 브라우저 안내 배너는 /start **첫 화면(page.tsx)** 에서만 — 여기(레이아웃)에
  // 두면 설문·결과 화면에도 떠서 '크롬으로 열기'가 초안(localStorage)이 없는 크롬으로
  // 보내 답과 이벤트 코드를 날렸다(출시점검 5차, 2026-09-26).
  return children
}
