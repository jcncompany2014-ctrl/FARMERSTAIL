/**
 * GET /api/integrations/tractive/connect
 *
 * Tractive OAuth 진입점. CSRF state 생성 → cookie 저장 → authorize URL 로
 * 302 redirect. mock mode 면 자체 안내 URL (/mypage/integrations?mock=1)
 * 로 redirect — UI 가 "준비 중" 안내 표시.
 *
 * 흐름:
 *   사용자 → /api/integrations/tractive/connect
 *   → CSRF state cookie set
 *   → 302 → tractiveAuthorizeUrl(state)
 *   → Tractive OAuth (real) / mypage/integrations (mock)
 *   → callback 에서 state 검증
 */
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { tractiveAuthorizeUrl } from '@/lib/integrations/tractive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // CSRF state — 32 bytes hex.
  const state = randomBytes(32).toString('hex')
  const url = tractiveAuthorizeUrl(state)

  const res = NextResponse.redirect(url, { status: 302 })
  // state cookie — httpOnly, 10분 TTL.
  res.cookies.set('tractive_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}
