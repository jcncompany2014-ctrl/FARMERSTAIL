import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogs/[id]/photo-request — 친구 사진 부탁 토큰 발급.
 *
 * 기존 active 토큰 (미업로드) 이 있으면 재사용 — URL 변경 X (카카오톡에
 * 붙여둔 링크가 깨지지 않게). 7일 만료.
 */

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  // audit 1-10: 같은 사용자가 토큰을 무한 발급해 storage 룸 / 카카오톡 스팸을
  // 차단. IP 기준 분당 6회 / 사용자 기준 24h 30회.
  const rl = rateLimit({
    bucket: 'photo-request:min',
    key: ipFromRequest(req),
    limit: 6,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const { id: dogId } = await params
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

  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 미업로드 + 미만료 + 미취소 토큰 재사용
  const { data: existing } = await supabase
    .from('photo_request_tokens')
    .select('token, expires_at')
    .eq('dog_id', dogId)
    .is('uploaded_photo_url', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let token: string
  let expiresAt: string

  if (existing) {
    token = (existing as { token: string }).token
    expiresAt = (existing as { expires_at: string }).expires_at
  } else {
    token = randomBytes(20).toString('base64url')
    expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const { error } = await supabase.from('photo_request_tokens').insert({
      dog_id: dogId,
      created_by: user.id,
      token,
      expires_at: expiresAt,
    })
    if (error) {
      return NextResponse.json(
        { code: 'DB_ERROR', message: '토큰을 만들지 못했어요' },
        { status: 500 },
      )
    }
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://farmerstail.kr'
  const url = `${origin}/photo-upload/${encodeURIComponent(token)}`

  return NextResponse.json({ ok: true, token, url, expiresAt })
}
