import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import OrderRealtimeBell from '@/components/admin/OrderRealtimeBell'
import AdminShell from '@/components/admin/AdminShell'

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

  // 셸(사이드바·드로어·본문 프레임) = client — 모바일 드로어 open 상태가 필요.
  // 이 layout 은 auth 조회 때문에 server 여야 하므로 email·벨만 주입한다.
  // 기능형 클린 어드민(2026-07 Phase B): 중립 다크(#16181d) + 회색조,
  // terracotta 는 active/포인트에만 절제 사용.
  return (
    <AdminShell userEmail={user.email ?? ''} bell={<OrderRealtimeBell />}>
      {children}
    </AdminShell>
  )
}