import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

/**
 * GET /api/newsletter/confirm?token=...
 *
 * 뉴스레터 double opt-in confirm 링크. 사용자가 메일에 박힌 링크 클릭 시 호출.
 * confirm_token 매칭 → status='confirmed', confirmed_at=now(). 성공 시 친화적인
 * confirmation 페이지로 redirect.
 *
 * # RLS / 클라이언트 선택
 * 이전엔 anon UPDATE 를 RLS 로 열고 라우트가 `.eq()` 로 좁혔는데, anon 키를 들고
 * supabase-js raw 호출로 token 검증 없이 mass-confirm 이 가능했다 (마이그레이션
 * 20260502000000 에서 정책 제거). 이제 confirm/unsubscribe 는 service-role 로
 * RLS 를 우회하되, 라우트 자체가 token 정규식 + .eq() 로 1행만 좁히는 검증을
 * 한다.
 *
 * # 보안
 * - Token: 32자 hex (uuid replace) — 128-bit 엔트로피, brute force 비현실적
 * - Rate limit: IP 당 분당 10회 — token 추측 시도 / 메일 클릭 봇 / 회귀 방어
 * - 미매칭 시 generic redirect (token 존재 여부 누설 안 함)
 */

export async function GET(req: Request) {
  // Token 추측 시도 방어. 메일 클릭은 정상이라 분당 10회로 여유.
  const rl = rateLimit({
    bucket: 'newsletter-confirm',
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
  const token = url.searchParams.get('token')?.trim()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin

  if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=invalid`)
  }

  const supabase = createAdminClient()

  // 1) token 매칭 row 찾기
  const { data: row } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, status')
    .eq('confirm_token', token)
    .maybeSingle()

  if (!row) {
    // 이미 confirmed 처리되어 token 이 cleared 되었거나, 존재하지 않는 token.
    return NextResponse.redirect(`${baseUrl}/newsletter?status=invalid`)
  }

  if (row.status === 'confirmed') {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=already`)
  }

  // 2) confirm
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirm_token: null, // 일회용 — 재사용 금지
    })
    .eq('id', row.id)

  if (error) {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=error`)
  }

  return NextResponse.redirect(`${baseUrl}/newsletter?status=confirmed`)
}
