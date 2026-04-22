import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPushConfigured } from '@/lib/push'

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

  let body: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: '잘못된 요청' },
      { status: 400 }
    )
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: '구독 정보가 누락됐어요' },
      { status: 400 }
    )
  }

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
