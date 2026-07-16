/**
 * /faq 레이아웃 — pass-through.
 *
 * chrome 은 page.tsx 가 AuthAwareShell 로 컨텍스트별 렌더(2026-07-16 사장님:
 * "앱에서 FAQ 누르면 웹으로 넘어가면 안 됨"). 웹=WebChrome, 앱=AppChrome.
 * 레이아웃은 chrome 을 강제하지 않아 이중 래핑을 피한다(page 가 단독으로 감쌈).
 */
export default function FaqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
