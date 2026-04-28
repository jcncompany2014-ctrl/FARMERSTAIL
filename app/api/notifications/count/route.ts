import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications/count
 *
 * 사용자가 마지막으로 인박스를 본 시점 (`notifications_last_seen_at`) 이후
 * 발생한 actionable 한 변경의 개수를 반환. 현재 정의:
 *   - 배송 시작 / 배송 완료된 본인 주문
 *
 * 추후 restock 알림, 쿠폰 만료 임박 등을 합쳐 가산 가능.
 *
 * 응답: `{ count: number }`. 비로그인은 401.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('notifications_last_seen_at')
    .eq('id', user.id)
    .maybeSingle()

  // 한 번도 본 적 없는 사용자는 가입 직후엔 모든 과거 주문이 unread 가 되니까,
  // 가입 직후 (last_seen_at 이 null) 면 "최근 7일" 윈도우로 클램프.
  const sinceIso =
    profile?.notifications_last_seen_at ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // shipping / delivered 상태로 변경됐고, updated_at 이 cutoff 이후인 본인 주문.
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('order_status', ['shipping', 'delivered'])
    .gt('updated_at', sinceIso)

  if (error) {
    console.error('[notifications/count] orders query failed', error)
    // 카운트 실패가 UX 를 막지 않게 — 0 으로 graceful fallback.
    return NextResponse.json({ count: 0 }, { status: 200 })
  }

  return NextResponse.json({ count: count ?? 0 }, { status: 200 })
}
