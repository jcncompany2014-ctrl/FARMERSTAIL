import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogs/[id]/vet-share — 수의사 read-only 공유 토큰 발급.
 *
 * 기존 active 토큰이 있으면 재사용 (URL 변경 X — 사용자가 메모/메시지에
 * 붙여 둔 링크가 깨지지 않게). 없으면 새로 생성.
 *
 * 응답: { ok, token, url, expiresAt }
 */

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
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

  // 소유 검증 — RLS 가 통과시켜 줄 row 만 조회
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

  // 기존 active 토큰 재사용
  const { data: existing } = await supabase
    .from('vet_share_tokens')
    .select('token, expires_at')
    .eq('dog_id', dogId)
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
    token = randomBytes(20).toString('base64url') // ≈27 문자, URL safe
    expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString()
    const { error } = await supabase.from('vet_share_tokens').insert({
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
    'https://www.farmerstail.kr'
  const url = `${origin}/vet/${encodeURIComponent(token)}`

  return NextResponse.json({ ok: true, token, url, expiresAt })
}

/**
 * DELETE /api/dogs/[id]/vet-share?token=... — revoke 특정 토큰.
 * token 미지정 시 dog 의 모든 active 토큰 revoke.
 */
export async function DELETE(req: Request, { params }: Params) {
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

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  let query = supabase
    .from('vet_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('dog_id', dogId)
    .is('revoked_at', null)

  if (token) {
    query = query.eq('token', token)
  }

  const { error } = await query
  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: '취소하지 못했어요' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
