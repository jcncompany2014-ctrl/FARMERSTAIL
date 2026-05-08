import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cs/reply — 사용자가 admin 의 1:1 메시지에 답장.
 *
 * cs_messages 테이블에 sender='user' 로 insert. RLS 가 자기 user_id 만 허용.
 * Admin 측 inbox 에서 sender='user' AND read_at IS NULL 로 미확인 큐 조회.
 *
 * GET — 자기 thread 의 최근 50개 fetch (사용자 알림센터에서 호출).
 */

const zReply = z.object({
  body: z.string().trim().min(1).max(2000),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'cs-reply',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zReply)
  if (!parsed.ok) return parsed.response

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('cs_messages').insert({
    user_id: user.id,
    sender: 'user',
    sender_id: user.id,
    body: parsed.data.body,
  })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('cs_messages')
    .select('id, sender, body, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // desc 로 가져와 reverse — 사용자 화면에선 시간순 (오래된 → 최근).
  const messages = (data ?? []).slice().reverse()
  return NextResponse.json({ ok: true, messages })
}
