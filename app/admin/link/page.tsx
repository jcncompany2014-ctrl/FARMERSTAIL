import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, LoadError } from '@/components/admin/ui'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { bannerWindow } from '@/lib/link-content/status'
import LinkAdminClient, { type BannerRow, type LinkSettings } from './LinkAdminClient'

/**
 * /admin/link — 인스타 프로필 링크 페이지(/link) 콘텐츠 관리 (사장님 2026-09-26).
 *
 * 커버 사진 · 이벤트/모집 배너(기간 포함) · '파머스테일의 하루' 사진 · 스마트스토어
 * 카드 표시. 저장하면 /link 가 바로 재생성된다(revalidatePath). 기간이 지난 배너는
 * 14일간 회색 "기간 종료"로 남았다가 자동으로 사라진다(lib/link-content/status.ts).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '링크 페이지',
  robots: { index: false, follow: false },
}

export default async function AdminLinkPage() {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/link')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const admin = createAdminClient()
  const today = todayKstIsoDate()
  // 규칙1 — error 를 버리면 조회 실패가 "배너 없음"으로 위장한다.
  const [settingsRes, bannersRes] = await Promise.all([
    admin.from('link_page_settings').select('cover_url, moment_urls, show_store_card').eq('id', 1).maybeSingle(),
    admin
      .from('link_banners')
      .select('id, sort_order, enabled, variant, badge, notice, title, sub, href, image_url, starts_on, ends_on')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (settingsRes.error || bannersRes.error || !settingsRes.data) {
    return (
      <>
        <AdminHeader title="링크 페이지" sub="인스타 프로필 링크(/link) 콘텐츠" />
        <LoadError what="링크 페이지 설정" />
      </>
    )
  }

  const settings: LinkSettings = settingsRes.data
  const banners: BannerRow[] = (bannersRes.data ?? []).map((b) => ({
    ...b,
    variant: b.variant === 'poster' ? 'poster' : 'photo',
    window: bannerWindow(today, b.starts_on, b.ends_on),
  }))

  return (
    <>
      <AdminHeader
        title="링크 페이지"
        sub="인스타 프로필 링크(farmerstail.kr/link) — 커버 사진 · 이벤트/모집 배너 · 하루 사진. 저장하면 바로 반영돼요."
      />
      <LinkAdminClient today={today} settings={settings} banners={banners} />
    </>
  )
}
