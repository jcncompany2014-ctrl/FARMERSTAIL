// R15-C24: 가족 초대 토큰 발급 API.
//
// POST /api/invitations/create
// body: { dog_id: string, email: string, role?: 'co_guardian' | 'viewer' }
//
// 1) 인증 + dog ownership 검증
// 2) token = crypto.randomBytes(32).toString('hex')
// 3) dog_invitations INSERT (expires_at = +7d)
// 4) 응답: { token, accept_url, expires_at }
//
// 이메일 발송은 phase 2 — 사용자가 직접 URL share 우선.

import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ROLES = ['co_guardian', 'viewer'] as const
type Role = (typeof ROLES)[number]

interface Body {
  dog_id?: string
  email?: string
  role?: string
}

function getOrigin(req: Request): string {
  const headers = req.headers
  const forwardedHost = headers.get('x-forwarded-host')
  const host = forwardedHost ?? headers.get('host') ?? 'farmerstail.app'
  const proto =
    headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const dogId = body.dog_id?.trim()
  const email = body.email?.trim().toLowerCase()
  const role: Role = ROLES.includes(body.role as Role)
    ? (body.role as Role)
    : 'co_guardian'

  if (!dogId || !email) {
    return NextResponse.json(
      { error: 'missing_fields', fields: ['dog_id', 'email'] },
      { status: 400 },
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // dog ownership 검증
  const { data: dog, error: dogErr } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (dogErr || !dog) {
    return NextResponse.json({ error: 'dog_not_found' }, { status: 404 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: insertErr } = await supabase.from('dog_invitations').insert({
    dog_id: dogId,
    email,
    invited_by: user.id,
    role,
    token,
    expires_at: expiresAt,
  })

  if (insertErr) {
    return NextResponse.json(
      { error: 'insert_failed', detail: insertErr.message },
      { status: 500 },
    )
  }

  const acceptUrl = `${getOrigin(req)}/invitations/${token}`

  return NextResponse.json({
    token,
    accept_url: acceptUrl,
    expires_at: expiresAt,
    dog_name: dog.name,
  })
}
