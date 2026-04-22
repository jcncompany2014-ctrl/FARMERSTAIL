import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/test
 * Sends a test notification to every subscription of the calling user.
 * Handy for the "알림 테스트" button on the notifications page.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }

  const result = await pushToUser(user.id, {
    title: '파머스테일',
    body: '알림이 정상적으로 연결됐어요 🐾',
    url: '/mypage/notifications',
    tag: 'test',
  })

  if (!result.ok) {
    return NextResponse.json(
      { code: result.reason ?? 'PUSH_FAILED', message: '푸시 전송 실패' },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, sent: result.sent, dead: result.dead })
}
