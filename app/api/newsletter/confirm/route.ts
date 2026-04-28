import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/newsletter/confirm?token=...
 *
 * 뉴스레터 double opt-in confirm 링크. 사용자가 메일에 박힌 링크 클릭 시 호출.
 * confirm_token 매칭 → status='confirmed', confirmed_at=now(). 성공 시 친화적인
 * confirmation 페이지로 redirect.
 *
 * RLS: 일반 anon insert 만 허용하므로 update 는 service role 이 필요.
 *      이 라우트는 server-side service role 클라이언트를 사용해야 한다 — 다만
 *      현 코드베이스는 createClient (anon) 를 사용 중이라 confirm/unsubscribe 도
 *      anon 키로 동작시키되, RLS 정책에 익명 update 를 별도로 허용하거나
 *      Supabase admin RPC 를 통해 처리해야 한다. 1차는 token-based update 를
 *      실행 — RLS 가 막으면 운영 후 admin policy 를 보정.
 *
 * 보안: token 은 32자 hex (uuid replace) 라 brute force 비현실적. 그래도 미스
 *      매칭 시 generic 메시지 반환.
 */

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin

  if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
    return NextResponse.redirect(`${baseUrl}/newsletter?status=invalid`)
  }

  const supabase = await createClient()

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
