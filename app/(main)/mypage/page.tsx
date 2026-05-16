// audit #101 — /mypage server wrapper. profile + 5 stat counts (orders, subs,
// points, wishlist, coupons) 를 server 에서 한 번에 prefetch. 미인증 시 즉시
// redirect (이전: client useEffect 미인증 무시 → 빈 stat 노출 가능).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MypageClient from './MypageClient'

type Profile = {
  name: string | null
  phone: string | null
  tier?: string | null
  cumulative_spend?: number | null
}

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/mypage')
  }

  const nowIso = new Date().toISOString()

  const [
    profileRes,
    orderCountRes,
    subCountRes,
    ledgerRes,
    wishCountRes,
    couponCountRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, phone, tier, cumulative_spend')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('point_ledger')
      .select('balance_after')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('wishlists')
      .select('product_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    // 쿠폰 — 활성 + 미만료. 정밀 per_user 필터는 체크아웃에서.
    supabase
      .from('coupons')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  ])

  const profile = (profileRes.data as Profile | null) ?? null
  const pointBalance =
    (ledgerRes.data as { balance_after?: number | null } | null)
      ?.balance_after ?? 0

  return (
    <MypageClient
      email={user.email ?? null}
      profile={profile}
      orderCount={orderCountRes.count ?? 0}
      subCount={subCountRes.count ?? 0}
      pointBalance={pointBalance}
      wishCount={wishCountRes.count ?? 0}
      couponCount={couponCountRes.count ?? 0}
    />
  )
}
