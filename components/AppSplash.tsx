/**
 * AppSplash — 설치형 PWA 첫 실행 전체화면 로고 모션 스플래시.
 *
 * 사장님(2026-07-13): "앱 처음 열 때 자연스러운 로고 모션 + 하단 점 3개".
 * 콜드 실행 1회 노출 후 자연 페이드아웃(네이티브 앱 스플래시 관용구). 새로고침 =
 * 새 콜드 실행이라 다시 노출.
 *
 * ── 왜 CSS 전용(무 JS)인가 ──────────────────────────────────────────────
 * 이전 JS(useEffect)판은 SSR 이 아무것도 안 그리다가 마운트 후 등장 →
 * 하이드레이션 직전 페이지 본문이 ~0.1s 먼저 보였다가 스플래시가 덮는 플래시가
 * 있었다(사장님 리포트). 그래서 이 오버레이를 SSR HTML 에 항상 렌더해 **첫
 * 페인트부터** 화면을 덮고, 노출 게이트/자동 종료를 전부 CSS 로 처리한다:
 *   · 게이트: @media (display-mode: standalone) + html.ft-standalone
 *     (iOS 레거시 navigator.standalone → app/layout.tsx head 인라인 스크립트가
 *      html 에 클래스 부여). 브라우저는 display:none 이라 첫 페인트부터 안 보임.
 *   · 자동 종료: ft-splash-dismiss 키프레임(forwards)이 ~1.4s 유지 후 페이드 →
 *     visibility:hidden. JS 타이밍/실패 여지 없음.
 * 스타일·모션은 전부 globals.css `.ft-splash` 스코프. (server component)
 */
export default function AppSplash() {
  return (
    <div className="ft-splash" aria-hidden>
      {/* 헤더와 동일 워드마크. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ft-splash__logo" src="/logo-ink.png" alt="" />
      <div className="ft-splash__dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
