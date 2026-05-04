import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications/count
 *
 * 사용자가 마지막으로 인박스를 본 시점 (`notifications_last_seen_at`) 이후
 * 발생한 actionable 한 변경 개수 + push_log 의 read_at IS NULL 합산.
 *
 *   - 배송 시작 / 배송 완료된 본인 주문 (last_seen 이후)
 *   - push_log 의 읽지 않은 알림 (체크인 / 동의 / 박스 도착 등)
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

  const sinceIso =
    profile?.notifications_last_seen_at ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 두 카운트 병렬 실행.
  const [orderRes, pushRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('order_status', ['shipping', 'delivered'])
      .gt('updated_at', sinceIso),
    supabase
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  if (orderRes.error) {
    console.error('[notifications/count] orders query failed', orderRes.error)
  }

  const orderCount = orderRes.count ?? 0
  const pushCount = pushRes.count ?? 0
  return NextResponse.json(
    { count: orderCount + pushCount, orders: orderCount, push: pushCount },
    { status: 200 },
  )
}
