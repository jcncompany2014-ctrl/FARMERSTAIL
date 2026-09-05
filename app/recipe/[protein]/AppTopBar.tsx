import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * 앱 진입용 상단 고정바 — 토스식 (2026-09-05 사장님: "동그란 버튼이 아니라
 * 토스 화면처럼 상단 고정바에" — 떠 있는 원형 버튼 1차안 기각).
 *
 * 전폭 고정바(블러 + 헤어라인) 안에 ← 하나. 목적지는 히스토리 되감기가
 * 아니라 홈(/dashboard) — AppChrome 의 계층형 up-nav 규칙(R-feel
 * 2026-06-19)과 동일. env(safe-area-inset-top)으로 네이티브 상태바 회피.
 * sticky 라 흐름 안에서 자리(높이)를 차지하고 스크롤 시 상단에 붙는다.
 */
export default function AppTopBar() {
  return (
    <div
      className="sticky top-0 z-50"
      style={{
        // 반투명도를 낮춰 스크롤 시 콘텐츠가 은은히 비치는 블러가 살도록
        // (2026-09-05 사장님: "살짝 블러처리 하는 느낌도").
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(14px) saturate(150%)',
        WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        borderBottom: '1px solid var(--fd-line)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div
        className="flex items-center"
        style={{ minHeight: 52, padding: '0 8px' }}
      >
        <Link
          href="/dashboard"
          aria-label="뒤로"
          className="flex items-center justify-center transition active:scale-95"
          style={{ padding: 12, color: 'var(--fd-pine)' }}
        >
          <ArrowLeft size={23} strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
