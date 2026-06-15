/**
 * /brand 레이아웃 — pass-through (앱/웹 완벽분리, 2026-06-13 사장님 지시).
 *
 * 이전: AuthAwareShell → PWA 에서 AppChrome 가 깔려 페이지의 WebChrome 와
 * 이중 래핑. /brand 페이지가 직접 WebChrome 를 렌더하므로 레이아웃은
 * chrome 을 강제하지 않는다(웹 전용 고정).
 */
export default function BrandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
