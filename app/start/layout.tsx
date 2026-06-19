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
  return children
}
