import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * 앱 진입용 좌상단 고정 뒤로가기 (2026-09-05 사장님 지시 — "앱에서 이 웹
 * 상세페이지가 열리면 상단 왼쪽 뒤로가기 화살표만 항상 고정").
 *
 * 목적지는 히스토리 되감기가 아니라 홈(/dashboard) — AppChrome 의
 * 계층형 up-nav 규칙(R-feel 2026-06-19, "뒤로가기가 웹스타일" 지적)과 동일.
 * QR 레시피 페이지의 구조상 부모는 홈이고, 페이지 안에서 다른 레시피로
 * 건너다녀도 ← 한 번이면 항상 홈으로 예측 가능하게 나간다.
 * env(safe-area-inset-top) — 네이티브 상태바 아래로.
 */
export default function AppBackButton() {
  return (
    <Link
      href="/dashboard"
      aria-label="뒤로"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 14,
        zIndex: 60,
        width: 40,
        height: 40,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px) saturate(140%)',
        WebkitBackdropFilter: 'blur(10px) saturate(140%)',
        boxShadow:
          '0 2px 10px rgba(23,59,51,0.16), inset 0 0 0 1px var(--fd-line)',
        color: 'var(--fd-pine)',
      }}
    >
      <ArrowLeft size={20} strokeWidth={2.4} aria-hidden />
    </Link>
  )
}
