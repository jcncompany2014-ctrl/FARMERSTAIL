import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/client'
import { renderDogInvitation } from '@/lib/email/templates/dog-invitation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogs/[id]/invite — 가족 초대 발송.
 *
 * 입력: { email, role?: 'member' | 'viewer' }
 * 동작:
 *   1) auth 확인 + RLS 가 dog owner 만 통과
 *   2) 32 바이트 url-safe 토큰 생성
 *   3) dog_invitations insert
 *   4) 메일 발송 (best-effort — 실패해도 200 + 'email_failed' flag)
 *
 * 같은 (dog, email) 의 pending 초대가 이미 있으면 새 token 으로 update —
 * 사용자가 메일을 못 받았을 때 재발송 시나리오.
 */

const zInvite = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['member', 'viewer']).default('member'),
})

type Params = { params: Promise<{ id: string }> }

function makeToken(): string {
  // url-safe base64 (RFC 4648 §5) — 32 bytes ≈ 43 문자
  return randomBytes(32).toString('base64url')
}

export async function POST(req: Request, { params }: Params) {
  const rl = rateLimit({
    bucket: 'dog-invite',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429 },
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

  const parsed = await parseRequest(req, zInvite)
  if (!parsed.ok) return parsed.response
  const { email, role } = parsed.data

  // 자기 자신 초대 차단
  if (email === (user.email ?? '').toLowerCase()) {
    return NextResponse.json(
      { code: 'SELF_INVITE', message: '본인은 이미 owner 예요' },
      { status: 400 },
    )
  }

  // dog 확인 — RLS 가 owner 만 select 가능. 다른 owner 의 dog 면 row 없음.
  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name, user_id')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 기존 pending 초대 — 재발송 시 새 token 으로 update
  const { data: existing } = await supabase
    .from('dog_invitations')
    .select('id')
    .eq('dog_id', dogId)
    .eq('email', email)
    .is('accepted_at', null)
    .is('declined_at', null)
    .maybeSingle()

  const token = makeToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  if (existing) {
    const { error } = await supabase
      .from('dog_invitations')
      .update({
        token,
        role,
        expires_at: expiresAt,
        invited_by: user.id,
      })
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json(
        { code: 'DB_ERROR', message: '초대를 만들지 못했어요' },
        { status: 500 },
      )
    }
  } else {
    const { error } = await supabase.from('dog_invitations').insert({
      dog_id: dogId,
      invited_by: user.id,
      email,
      token,
      role,
      expires_at: expiresAt,
    })
    if (error) {
      return NextResponse.json(
        { code: 'DB_ERROR', message: '초대를 만들지 못했어요' },
        { status: 500 },
      )
    }
  }

  // 메일 발송 (best-effort) — 실패해도 흐름 진행
  const inviterName =
    (user.user_metadata?.name as string | undefined) ||
    (user.email ? user.email.split('@')[0] ?? '가족 한 분' : '가족 한 분')
  const { subject, html } = renderDogInvitation({
    inviterName,
    dogName: (dog as { name: string }).name,
    role,
    token,
    expiresAt,
  })
  const result = await sendEmail({
    to: email,
    subject,
    html,
    tag: 'dog-invitation',
  })

  return NextResponse.json({
    ok: true,
    token,
    emailSent: result.ok,
    expiresAt,
  })
}
