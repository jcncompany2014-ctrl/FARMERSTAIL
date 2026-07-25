// audit #101 — /mypage server wrapper. profile + 결제완료 주문 수 + active 구독 수를
// server 에서 한 번에 prefetch. (points·wishlist·coupons stat 은 그 기능들이 폐지되며
// 사라짐 — 2026-07 주석 정정.) 미인증 시 즉시 redirect
// (이전: client useEffect 미인증 무시 → 빈 stat 노출 가능).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import MypageClient from './MypageClient'

type Profile = {
  name: string | null
  phone: string | null
  tier?: string | null
  stamp_count?: number | null
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
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, phone, tier, stamp_count')
      .eq('id', user.id)
      .maybeSingle(),
    // 결제 완료한 것만 카운트 (사장님 2026-07-22 "뜨는 건 결제 완료한 것만"):
    //  · paid_at 있는 것만 = 결제된 적 없는 유령(pending·failed·미결제 cancelled) 제외.
    //  · 추가로 환불(refunded)은 카운트에서 제외 유지(사장님 2026-06-19, '유효 주문' 수).
    //  (주문 내역 목록은 환불도 이력으로 보여주지만, 헤드라인 카운트는 유효 주문만.)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('paid_at', 'is', null)
      .neq('payment_status', 'refunded'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      // 카드 미등록 '유령 활성'(next_delivery_date=null) 제외 — 홈(dashboard)의
      // hasActiveSub 판정(next_delivery_date!==null)과 동일 기준. status='active' 만
      // 세면 카드 등록 前 구독이 홈엔 안 뜨는데 여기 'Subs' 통계엔 잡혀 화면 간
      // 불일치가 났다(2026-07-23 정합).
      .not('next_delivery_date', 'is', null),
  ])

  const profile = (profileRes.data as Profile | null) ?? null
  // 운영자 본인만 보이는 관리자 진입점(2026-07-25) — 지금은 admin 주소를 직접
  // 쳐야 들어갈 수 있어서, 앱에서 폰으로 운영할 때 불편했다. 판정은 서버에서만
  // (클라에 role 을 내려주지 않는다 — 화면 노출 여부만 boolean 으로 전달).
  const admin = await isAdmin(supabase, user)
  return (
    <MypageClient
      email={user.email ?? null}
      profile={profile}
      orderCount={orderCountRes.count ?? 0}
      subCount={subCountRes.count ?? 0}
      isAdmin={admin}
    />
  )
}
