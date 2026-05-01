import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zPushUnsubscribe } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'

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

  const parsed = await parseRequest(req, zPushUnsubscribe)
  if (!parsed.ok) return parsed.response

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', parsed.data.endpoint)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
