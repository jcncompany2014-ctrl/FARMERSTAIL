import Link from 'next/link'

/**
 * 앱 진입용 윗줄 — 앱 깊은 화면과 같은 모양(2026-10-10 포스터 디자인: components/AppChrome 의 ← + 이름).
 *
 * 이 화면은 AppChrome 밖(가게 틀도 아님)이라 윗줄을 직접 그린다. 높이 56 · 셸 색(--ft-native-bg) ·
 * 꺾쇠 26px · 이름은 포스터 글꼴 22px. 목적지는 히스토리 되감기가 아니라 홈(/dashboard) — QR 로 앱이 바로
 * 열리면 되감을 곳이 없다(계층형 up-nav). env(safe-area-inset-top)으로 네이티브 상태바를 피한다.
 */
export default function AppTopBar({ title }: { title: string }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--ft-native-bg)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ minHeight: 56, padding: '0 8px 0 6px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Link
          href="/dashboard"
          aria-label="뒤로"
          style={{ width: 48, height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#141414' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="d" style={{ fontSize: 22, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
      </div>
    </header>
  )
}
