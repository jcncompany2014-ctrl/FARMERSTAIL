/**
 * GET /api/marketing/unsubscribe?uid=<userId>&token=<HMAC>
 *
 * R87-A3 (D10): 일반 app user 의 광고성 메일 1-click 수신거부 endpoint.
 * Gmail/Yahoo 2024.2 List-Unsubscribe One-Click 정책 + 정통망법 §50 1-click 의무.
 *
 * 처리:
 *   1. token 검증 (HMAC user_id + secret)
 *   2. profiles.agree_email = false 처리 (sms 는 별도)
 *   3. consent_log 에 withdrawal 기록
 *   4. /unsubscribed?status=ok 로 redirect
 *
 * 보안:
 *   - rate limit (IP 당 10/분)
 *   - 잘못된 token → 400 → redirect to /unsubscribed?status=invalid
 *   - 이미 해지된 사용자 → 200 (idempotent)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { verifyMarketingUnsubscribeToken } from '@/lib/email/unsubscribe-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const rl = rateLimit({
    bucket: 'marketing-unsubscribe',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const url = new URL(req.url)
  const uid = url.searchParams.get('uid')?.trim()
  const token = url.searchParams.get('token')?.trim()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin

  // UUID 형식 + 토큰 32자 hex 검증.
  if (!uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
    return NextResponse.redirect(`${baseUrl}/unsubscribed?status=invalid`)
  }
  if (!token || !verifyMarketingUnsubscribeToken(uid, token)) {
    return NextResponse.redirect(`${baseUrl}/unsubscribed?status=invalid`)
  }

  const supabase = createAdminClient()

  // 1) profiles.agree_email = false (SMS 는 별도 채널이라 그대로).
  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      agree_email: false,
      agree_email_at: null,
    })
    .eq('id', uid)

  if (updErr) {
    return NextResponse.redirect(`${baseUrl}/unsubscribed?status=error`)
  }

  // 2) consent_log 에 withdrawal 기록 (정통망법 §50의2 동의 철회 audit).
  try {
    await supabase.from('consent_log').insert({
      user_id: uid,
      channel: 'email',
      granted: false,
      policy_version: null,
      source: 'marketing_unsubscribe_one_click',
    })
  } catch {
    /* audit 누락은 critical 아님 — 메인 update 는 성공 */
  }

  // POST 요청 (RFC 8058 One-Click) 도 같은 endpoint 처리.
  return NextResponse.redirect(`${baseUrl}/unsubscribed?status=ok`)
}

export async function POST(req: Request) {
  // RFC 8058: List-Unsubscribe-Post=List-Unsubscribe=One-Click 클릭 시 POST.
  // GET 과 동일 로직.
  return GET(req)
}
