import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/seen
 *
 * 사용자가 인박스 (현재는 /mypage/orders) 를 열었을 때 호출. profiles
 * .notifications_last_seen_at 을 NOW() 로 갱신해 unread 카운트를 0 으로 리셋.
 *
 * 멱등 — 여러 번 호출해도 부작용 없음. 빈 응답 (204) 로 가볍게.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ notifications_last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[notifications/seen] update failed', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return new NextResponse(null, { status: 204 })
}
