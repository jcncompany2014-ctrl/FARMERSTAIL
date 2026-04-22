import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/unsubscribe
 * body: { endpoint: string }
 * Deletes only the caller's row — RLS stops us touching someone else's sub.
 */
export async function POST(req: Request) {
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

  let body: { endpoint?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: '잘못된 요청' },
      { status: 400 }
    )
  }
  if (!body.endpoint) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'endpoint가 필요합니다' },
      { status: 400 }
    )
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
