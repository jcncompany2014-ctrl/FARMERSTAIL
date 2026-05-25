/**
 * GET /api/integrations/tractive/callback
 *
 * Tractive OAuth callback. ?code= + ?state= 받아서:
 *   1) state cookie 와 비교 → CSRF 방지
 *   2) exchangeTractiveCode(code) → access_token 획득
 *   3) user_integrations 에 upsert (status='active')
 *   4) /mypage/integrations?ok=tractive 로 redirect
 *
 * mock mode 면 exchangeTractiveCode 가 fake token 반환 → DB row 도 fake.
 * UI 가 "준비 중" badge 로 표시.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeTractiveCode } from '@/lib/integrations/tractive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const stateCookie = req.headers.get('cookie')?.match(
    /tractive_oauth_state=([^;]+)/,
  )?.[1]

  if (!code) {
    return NextResponse.redirect(
      new URL('/mypage/integrations?error=missing_code', url),
      { status: 302 },
    )
  }
  if (!state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(
      new URL('/mypage/integrations?error=invalid_state', url),
      { status: 302 },
    )
  }

  try {
    const tokens = await exchangeTractiveCode(code)
    // upsert — UNIQUE(user_id, provider) 가드. 같은 사용자 재연동 시 토큰 갱신.
    // user_integrations 타입은 types.ts 에 아직 반영 X — cast 로 우회.
    const ui = supabase.from('user_integrations' as never) as unknown as {
      upsert: (
        v: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>
    }
    const { error } = await ui.upsert(
      {
        user_id: user.id,
        provider: 'tractive',
        external_user_id: tokens.externalUserId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt?.toISOString() ?? null,
        scope: tokens.scope,
        status: 'active',
      },
      { onConflict: 'user_id,provider' },
    )
    if (error) {
      return NextResponse.redirect(
        new URL('/mypage/integrations?error=db_failed', url),
        { status: 302 },
      )
    }
  } catch {
    return NextResponse.redirect(
      new URL('/mypage/integrations?error=token_exchange', url),
      { status: 302 },
    )
  }

  const res = NextResponse.redirect(
    new URL('/mypage/integrations?ok=tractive', url),
    { status: 302 },
  )
  // state cookie 정리.
  res.cookies.delete('tractive_oauth_state')
  return res
}
