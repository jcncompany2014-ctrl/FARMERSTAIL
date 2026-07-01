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
    <div className="min-h-screen bg-[#f6f7f9] flex">
      {/* 사이드바 — flex 컬럼: 로고(고정) / nav(스크롤) / 푸터(고정).
          nav 가 길어 뷰포트를 넘쳐도 푸터를 가리지 않고 스크롤된다.
          기능형 클린 어드민(2026-07 Phase B): 중립 다크(#16181d) + 회색조,
          terracotta 는 active/포인트에만 절제 사용. */}
      <aside className="w-60 shrink-0 bg-[#16181d] text-zinc-300 h-screen sticky top-0 flex flex-col">
        <div className="px-5 py-5 border-b border-white/10 shrink-0">
          <Link href="/admin" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-paper.png"
              alt="Farmer's Tail"
              className="h-7 w-auto"
            />
          </Link>
          <p className="text-[10px] text-zinc-500 mt-2 tracking-[0.2em] font-medium">
            ADMIN CONSOLE
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <AdminNav />
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-white/10">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Logged in as</p>
          <p className="text-xs text-zinc-200 mt-0.5 truncate">{user.email}</p>
          <Link
            href="/dashboard"
            className="mt-3 block text-[11px] text-zinc-400 hover:text-white transition"
          >
            ← 일반 화면으로
          </Link>
        </div>
      </aside>

      {/* 본문 */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* 상단바 — 실시간 주문 알림 벨 */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-8 h-12 flex items-center justify-end gap-3">
            <OrderRealtimeBell />
          </div>
        </header>
        <div className="max-w-6xl mx-auto w-full px-8 py-8 flex-1">{children}</div>
      </main>
    </div>
  )
}