import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

/**
 * GET /api/newsletter/unsubscribe?token=...
 *
 * 모든 발송 메일에 박혀야 하는 1-click unsubscribe 링크. RFC 8058 (List-
 * Unsubscribe header) 와 동일한 동선 — 클릭 한 번으로 즉시 해지.
 *
 * unsubscribe_token 은 가입 시 자동 발급된 영구 토큰 (확인 후 cleared 되지
 * 않음 — 같은 사용자가 여러 번 해지/재가입 가능해야 하니).
 *
 * # RLS / 클라이언트 선택
 * 이전엔 anon UPDATE 를 RLS 로 열어 anon 키로 mass-unsubscribe 가 가능했다
 * (마이그레이션 20260502000000 에서 정책 제거). 이제 service-role 로 RLS 우회
 * + 라우트가 token 매칭 + 1행 좁힘.
 */

export async function GET(req: Request) {
  const rl = rateLimit({
    bucket: 'newsletter-unsubscribe',
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

  const { data: row } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (!row) {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=invalid`)
  }

  if (row.status === 'unsubscribed') {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=already-unsubscribed`)
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (error) {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=error`)
  }

  return NextResponse.redirect(`${baseUrl}/newsletter?status=unsubscribed`)
}
