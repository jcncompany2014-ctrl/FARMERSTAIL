import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import SiteFooter from '@/components/SiteFooter'

/**
 * Shell for public legal/info pages (사업자정보, 이용약관,
 * 개인정보처리방침, 환불정책 등).
 *
 * These pages are reachable before login — they're linked from the
 * global footer that renders on the landing page too — so they can't
 * live inside `app/(main)/` which auth-gates everything. This shell
 * gives them the same brand background, max-width, and footer without
 * the sticky header / bottom nav.
 */
export default function PublicPageShell({
  children,
  backHref = '/',
  backLabel = '홈',
}: {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    // `phone-frame`: 데스크톱/태블릿(≥md)에서 "책상 위 폰" 프레임 비주얼로
    // 전환. 모바일(<md)은 규칙 전부 무시 → 기존 full-bleed 유지.
    // 상세 근거는 globals.css 주석 참조.
    <div className="phone-frame min-h-screen bg-bg">
      <div className="max-w-md mx-auto">
        <div className="px-5 pt-5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-0.5 text-[11px] font-bold text-muted hover:text-terracotta transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            {backLabel}
          </Link>
        </div>
        {children}
        <SiteFooter />
      </div>
    </div>
  )
}
