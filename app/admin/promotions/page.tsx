import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader } from '@/components/admin/ui'
import PromotionsClient, { type PromoWithStat } from './PromotionsClient'

/**
 * /admin/promotions — 오프라인·인스타 이벤트 관리.
 *
 * 여기서 이벤트를 하나 만들면 **주소 하나**가 나온다: `/start?p=<code>`
 *  · 오프라인: 그 주소의 QR 을 배너에 인쇄 → 부스에서 찍으면 바로 설문
 *  · 인스타:   그 주소를 프로필 링크·스토리에 → 탭하면 바로 설문
 * 고객은 **코드를 본 적도 입력한 적도 없다.**
 *
 * 성과(가입수·결제수)가 같이 보인다 — 지금 광고 추적이 없어서 이 두 숫자가
 * 채널별 성과를 읽는 유일한 창이다.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이벤트 · 프로모션',
  robots: { index: false, follow: false },
}

export default async function AdminPromotionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/promotions')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const admin = createAdminClient()
  const [{ data: promos }, { data: claims }] = await Promise.all([
    admin.from('promotions').select('*').order('created_at', { ascending: false }),
    admin.from('promotion_claims').select('promotion_id, redeemed_order_id'),
  ])

  const stat = new Map<string, { signups: number; orders: number }>()
  for (const c of (claims ?? []) as Array<{
    promotion_id: string
    redeemed_order_id: string | null
  }>) {
    const s = stat.get(c.promotion_id) ?? { signups: 0, orders: 0 }
    s.signups += 1
    if (c.redeemed_order_id) s.orders += 1
    stat.set(c.promotion_id, s)
  }

  const rows: PromoWithStat[] = (
    (promos ?? []) as Array<{
      id: string
      code: string
      name: string
      discount_rate: number
      starts_at: string
      ends_at: string
      max_signups: number | null
      active: boolean
    }>
  ).map((p) => ({
    ...p,
    signups: stat.get(p.id)?.signups ?? 0,
    orders: stat.get(p.id)?.orders ?? 0,
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

  return (
    <div className="pb-12">
      <AdminHeader
        title="이벤트 · 프로모션"
        sub="링크 하나로 첫 주문 할인 — 오프라인 QR · 인스타 링크"
      />
      <PromotionsClient initial={rows} siteUrl={siteUrl} />
    </div>
  )
}
