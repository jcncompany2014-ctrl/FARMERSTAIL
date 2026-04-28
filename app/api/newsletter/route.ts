import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/newsletter — 뉴스레터 구독 신청.
 *
 * Body: { email: string, source?: string }
 *
 * 동작:
 *   1. 이메일 형식 검증
 *   2. 기존 구독자 (status=confirmed) 면 200 + alreadySubscribed 반환
 *   3. 기존 구독자 (status=unsubscribed) 면 status='pending' 으로 재활성화
 *   4. 신규 → insert (status='pending', confirm_token 발급)
 *   5. 추후: Resend 로 confirm 메일 발송 — 1차는 placeholder
 *
 * RLS:
 *   - newsletter_subscribers 의 public insert 정책이 status=pending 만 허용.
 *   - 본 route 는 server-side anon client 를 사용해 정책에 맞게 insert.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  let body: { email?: string; source?: string }
  try {
    body = (await req.json()) as { email?: string; source?: string }
  } catch {
    return NextResponse.json(
      { code: 'BAD_BODY', message: '잘못된 요청 형식이에요.' },
      { status: 400 },
    )
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const source = (body.source ?? 'web').slice(0, 32)

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { code: 'INVALID_EMAIL', message: '올바른 이메일 주소를 입력해 주세요.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // 1) 기존 row 확인
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'confirmed') {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
        message: '이미 구독 중인 이메일이에요.',
      })
    }
    // pending / unsubscribed 모두 → pending 으로 재활성화 (새 token 발급)
    const confirmToken = crypto.randomUUID().replace(/-/g, '')
    const { error: upErr } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'pending',
        confirm_token: confirmToken,
        unsubscribed_at: null,
        source,
      })
      .eq('id', existing.id)
    if (upErr) {
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: '재활성화에 실패했어요.' },
        { status: 500 },
      )
    }
    // TODO: Resend 로 confirm 메일 발송 (env: NEWSLETTER_FROM, RESEND_API_KEY)
    return NextResponse.json({ ok: true, reactivated: true })
  }

  // 2) 신규 insert
  const confirmToken = crypto.randomUUID().replace(/-/g, '')
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error: insErr } = await supabase
    .from('newsletter_subscribers')
    .insert({
      email,
      user_id: user?.id ?? null,
      status: 'pending',
      confirm_token: confirmToken,
      source,
    })

  if (insErr) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '신청 중 오류가 발생했어요.' },
      { status: 500 },
    )
  }

  // TODO: confirm 메일 발송. 지금은 즉시 confirmed 로 마크 (추후 double opt-in 추가).
  await supabase
    .from('newsletter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('email', email)

  return NextResponse.json({ ok: true, subscribed: true })
}
