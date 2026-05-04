import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/seen
 *
 * 사용자가 인박스 (/notifications) 를 열었을 때 호출. 두 가지 갱신:
 *   1. profiles.notifications_last_seen_at = NOW() (주문 알림 unread 리셋)
 *   2. push_log.read_at = NOW() (현재 NULL 인 본인 행만)
 *
 * 멱등 — 여러 번 호출해도 부작용 없음.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const [profileRes] = await Promise.all([
    supabase
      .from('profiles')
      .update({ notifications_last_seen_at: now })
      .eq('id', user.id),
    supabase
      .from('push_log')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  if (profileRes.error) {
    console.error('[notifications/seen] update failed', profileRes.error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return new NextResponse(null, { status: 204 })
}
