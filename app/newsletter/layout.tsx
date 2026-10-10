/**
 * /newsletter 레이아웃 — 바깥 틀은 페이지가 SiteShell 로 직접 고른다(웹 = 새 웹 가게 틀, 앱 = AppChrome).
 * 2026-10-10 웹 리뉴얼(웹 시안 WEB-C13) — 예전엔 여기서 AuthAwareShell 이 웹/앱 틀을 골랐다(app/contact 와 같은 방식으로 옮김).
 * 앱에서도 열리는 주소다: 메일의 구독 확인·수신거부 링크가 앱을 열면 /newsletter?status=… 로 돌아온다(lib/native-nav).
 */
export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
