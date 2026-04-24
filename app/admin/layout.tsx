import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

// 관리자 페이지는 크롤 · 검색 인덱스 금지. robots.txt 차단과 이중화 —
// robots.txt 를 무시하는 크롤러 (arc.net, SEO 분석 도구) 대비.
export const metadata: Metadata = {
  title: {
    default: '관리자',
    template: '%s · 관리자 | 파머스테일',
  },
  robots: { index: false, follow: false, nocache: true },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  // app_metadata.role 우선, profiles.role fallback — 자세한 배경은 lib/auth/admin.ts.
  if (!(await isAdmin(supabase, user))) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* 사이드바 */}
      <aside className="w-60 shrink-0 bg-[#2A2118] text-bg min-h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-text">
          <Link href="/admin" className="block">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/logo.png"
    alt="Farmer's Tail"
    className="h-12 w-auto brightness-0 invert"
  />
</Link>
<p className="text-[10px] text-muted mt-2 tracking-widest">
  ADMIN CONSOLE
</p>
        </div>

        <nav className="px-3 py-4 space-y-1">
  <NavItem href="/admin" icon="📊" label="대시보드" />
  <NavItem href="/admin/orders" icon="📦" label="주문 관리" />
  <NavItem href="/admin/subscriptions" icon="🔁" label="정기배송" />   {/* ← 이거 */}
  <NavItem href="/admin/products" icon="🛍️" label="제품 관리" />
  <NavItem href="/admin/users" icon="👥" label="회원 관리" />
</nav>

        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-text">
          <p className="text-[10px] text-muted">LOGGED IN AS</p>
          <p className="text-xs text-white mt-0.5 truncate">{user.email}</p>
          <Link
            href="/dashboard"
            className="mt-3 block text-[10px] text-terracotta hover:text-[#8BA05A] transition"
          >
            ← 일반 화면으로
          </Link>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string
  icon: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-text hover:text-white transition"
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}