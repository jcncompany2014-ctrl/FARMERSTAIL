import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import OrderRealtimeBell from '@/components/admin/OrderRealtimeBell'
import AdminShellNext from '@/components/adminui/admin-shell-next'

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

  // getRequestUser = 요청 1회 캐시. layout 과 각 page 가 같은 요청에서 부르므로
  // auth 서버 왕복이 2회 → 1회로 준다(2026-07-25 렉 대응). 가드는 양쪽 다 유지.
  const user = await getRequestUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  // app_metadata.role 우선, profiles.role fallback — 자세한 배경은 lib/auth/admin.ts.
  if (!(await isAdmin(supabase, user))) {
    redirect('/dashboard')
  }

  // 셸(사이드바·드로어·본문 프레임) = client — 모바일 드로어 open 상태가 필요.
  // 이 layout 은 auth 조회 때문에 server 여야 하므로 email·벨만 주입한다.
  //
  // 2026-09-04 어드민 개편 Phase 2: 수제 AdminShell(내비 4개 노출) →
  // shadcn 기반 AdminShellNext(39개 라우트 업무 그룹 내비). shadcn 팔레트는
  // `.admin-scope` 서브트리에서만 유효(globals.css) — 웹/앱 무영향.
  // 구 셸 파일은 롤백 대비로 보존(components/admin/AdminShell.tsx).
  return (
    <div className="admin-scope min-h-screen bg-background font-sans text-foreground antialiased">
      <AdminShellNext userEmail={user.email ?? ''} bell={<OrderRealtimeBell />}>
        {children}
      </AdminShellNext>
    </div>
  )
}