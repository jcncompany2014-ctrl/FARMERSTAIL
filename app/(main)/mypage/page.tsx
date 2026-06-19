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

  const [
    profileRes,
    orderCountRes,
    subCountRes,
    ledgerRes,
    wishCountRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, phone, tier, cumulative_spend')
      .eq('id', user.id)
      .maybeSingle(),
    // 결제 취소·환불된 주문은 카운트에서 제외 (사장님 2026-06-19).
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('payment_status', 'cancelled')
      .neq('payment_status', 'refunded'),
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
    />
  )
}
