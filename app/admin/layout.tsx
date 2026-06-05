import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import OrderRealtimeBell from '@/components/admin/OrderRealtimeBell'
import AdminNav from '@/components/admin/AdminNav'

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
      {/* 사이드바 — flex 컬럼: 로고(고정) / nav(스크롤) / 푸터(고정).
          nav 가 길어 뷰포트를 넘쳐도 푸터를 가리지 않고 스크롤된다. */}
      <aside className="w-60 shrink-0 bg-[#2A2118] text-bg h-screen sticky top-0 flex flex-col">
        <div className="px-6 py-6 border-b border-text shrink-0">
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

        <div className="flex-1 min-h-0 overflow-y-auto">
          <AdminNav />
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-text">
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
      <main className="flex-1 min-w-0 flex flex-col">
        {/* 상단바 — 실시간 주문 알림 벨 */}
        <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-rule">
          <div className="max-w-6xl mx-auto px-8 h-12 flex items-center justify-end gap-3">
            <OrderRealtimeBell />
          </div>
        </header>
        <div className="max-w-6xl mx-auto w-full px-8 py-8 flex-1">{children}</div>
      </main>
    </div>
  )
}