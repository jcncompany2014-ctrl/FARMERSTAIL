import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPushConfigured } from '@/lib/push'
import { zPushSubscribe } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * body: PushSubscription JSON (from pushManager.subscribe().toJSON())
 * Upserts a subscription row keyed by endpoint.
 */
export async function POST(req: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { code: 'VAPID_NOT_CONFIGURED', message: '푸시 설정이 완료되지 않았어요' },
      { status: 503 }
    )
  }

  // 사용자가 여러 디바이스에서 구독 가능하지만 분당 5회면 충분.
  const rl = rateLimit({
    bucket: 'push-subscribe',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
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

  const parsed = await parseRequest(req, zPushSubscribe)
  if (!parsed.ok) return parsed.response
  const { endpoint, keys } = parsed.data
  const p256dh = keys.p256dh
  const auth = keys.auth

  // Upsert by endpoint (endpoint has a unique index from the migration).
  const userAgent = req.headers.get('user-agent') ?? null
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    { onConflict: 'endpoint' }
  )
  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
