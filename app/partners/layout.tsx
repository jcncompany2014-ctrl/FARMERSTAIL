/**
 * /partners 레이아웃 — pass-through (앱/웹 완벽분리, 회차85 수정).
 *
 * 이전: AuthAwareShell → /partners 페이지가 직접 WebChrome 를 렌더(회차55)하므로
 * AuthAwareShell 과 이중 래핑(웹=WebChrome×2 헤더/푸터 중복, 앱=AppChrome 이
 * WebChrome 를 감싸 누출). 마케팅 라우트 규칙대로 레이아웃은 chrome 을 강제하지
 * 않는다(웹 전용 고정, /science·/brand 와 동일).
 */
export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
