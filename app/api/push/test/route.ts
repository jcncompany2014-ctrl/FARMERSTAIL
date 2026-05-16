import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushToUser } from '@/lib/push'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/test
 * Sends a test notification to every subscription of the calling user.
 * Handy for the "알림 테스트" button on the notifications page.
 *
 * audit 1-8: 테스트 버튼을 무한 클릭해 본인 디바이스에 스팸 + push 비용
 * 부담을 막기 위해 분당 5회 / 시간당 20회 제한.
 */
export async function POST(req: Request) {
  const rlMin = rateLimit({
    bucket: 'push-test:min',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rlMin.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rlMin.headers },
    )
  }
  const rlHour = rateLimit({
    bucket: 'push-test:hour',
    key: ipFromRequest(req),
    limit: 20,
    windowMs: 60 * 60_000,
  })
  if (!rlHour.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rlHour.headers },
    )
  }

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
