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
    <div className="min-h-screen bg-bg">
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
