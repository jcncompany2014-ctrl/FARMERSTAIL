import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zPushUnsubscribe } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { dbError } from '@/lib/api/errors'

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
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 }
    )
  }

  const parsed = await parseRequest(req, zPushUnsubscribe)
  if (!parsed.ok) return parsed.response

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', parsed.data.endpoint)
    .eq('user_id', user.id)
  // 삭제 실패를 무시하면 사용자는 해제됐다고 믿지만 계속 푸시를 받게 됨.
  if (error) {
    return dbError(error, 'push_unsubscribe', '푸시 구독 해제에 실패했어요')
  }

  return NextResponse.json({ ok: true })
}
