/**
 * (main)/template.tsx — 라우트 전환마다 re-mount 되는 래퍼.
 *
 * Next App Router 규칙: `layout` 은 네비게이션 사이에 유지되지만 `template` 은
 * 매번 새 인스턴스로 마운트된다. 그래서 새 화면이 마운트될 때마다 CSS 진입
 * 애니메이션(`.ft-page-enter` = 살짝 아래서 페이드인)이 한 번 재생되어
 * '웹페이지 툭 바뀜' 대신 '앱처럼 부드럽게 넘어가는' 느낌을 준다.
 *
 * 헤더/탭바(AppChrome)는 layout 에 있어 영향 없음 — 본문만 전환된다.
 * prefers-reduced-motion 시 globals.css 전역 가드로 애니메이션 off.
 */
export default function MainTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="ft-page-enter">{children}</div>
}
