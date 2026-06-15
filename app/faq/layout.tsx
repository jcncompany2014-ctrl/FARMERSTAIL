/**
 * /faq 레이아웃 — pass-through (앱/웹 완벽분리, 2026-06-13 사장님 지시).
 *
 * 이전: AuthAwareShell 로 감싸 PWA 컨텍스트에선 AppChrome(하단 탭바)가 깔리고,
 * 페이지의 WebChrome 와 이중 래핑돼 웹 헤더+앱 탭바가 동시에 떴다.
 * → 웹 마케팅 페이지는 페이지 자체가 WebChrome 를 렌더하므로 레이아웃은
 *   chrome 을 강제하지 않는다(웹 전용 고정). 앱은 이 라우트를 링크하지 않음.
 */
export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
