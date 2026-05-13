import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/invitations/accept — magic link 토큰으로 초대 수락.
 *
 * 입력: { token }
 * 동작: accept_dog_invitation(p_token) RPC — token 검증 + dog_members 추가
 *      + invitations.accepted_at set atomic.
 *
 * 응답:
 *   ok: { ok: true, dogId, message }
 *   err: { ok: false, dogId?: uuid, message }
 *
 * 같은 token 재사용 시 RPC 가 'already accepted' 반환 → 200 + ok=false.
 */

const zAccept = z.object({
  token: z.string().min(8).max(256),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  const parsed = await parseRequest(req, zAccept)
  if (!parsed.ok) return parsed.response
  const { token } = parsed.data

  const { data, error } = await supabase.rpc('accept_dog_invitation', {
    p_token: token,
  })
  if (error) {
    return NextResponse.json(
      { code: 'RPC_ERROR', message: error.message ?? '수락하지 못했어요' },
      { status: 500 },
    )
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return NextResponse.json(
      { ok: false, message: '응답 없음' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: !!row.ok,
    dogId: row.dog_id ?? null,
    message: row.message ?? '',
  })
}

/**
 * POST 와 동일하지만 token 을 query string 으로 받아 magic link 형 GET.
 * Outlook safe-link 같은 prefetch 가 자동 수락하지 않도록 사실 POST 만
 * 권장하지만, 사용자가 메일 → 토큰 페이지 진입 시 GET 으로 검증할 수
 * 있도록 하는 fallback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return NextResponse.json(
      { code: 'MISSING_TOKEN', message: '토큰이 없어요' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: '로그인이 필요해요' })
  }

  // GET 은 검증만 (수락 X) — invitation 정보 미리보기에 사용
  const { data: inv } = await supabase
    .from('dog_invitations')
    .select(
      'dog_id, email, role, expires_at, accepted_at, declined_at, invited_by',
    )
    .eq('token', token)
    .maybeSingle()
  if (!inv) {
    return NextResponse.json({ ok: false, message: '유효하지 않은 초대예요' })
  }
  return NextResponse.json({ ok: true, invitation: inv })
}
