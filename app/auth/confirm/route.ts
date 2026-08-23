import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 이메일 인증 링크 착지점 — `/auth/confirm?token_hash=...&type=signup`
 *
 * # 왜 (2026-08-23 — 사장님: "인증되었습니다! 이런식으로 알려주는 게 낫지 않아?")
 * 예전 confirm-signup 템플릿은 `{{ .ConfirmationURL }}` 를 썼다 — Supabase 가
 * 인증 처리 후 SiteURL(홈)로 떨궈서, 사용자는 **아무 피드백 없이 랜딩에 선다.**
 * "된 건가?" 상태. 이제 템플릿이 이 라우트로 오고, 여기서 verifyOtp 로 인증한 뒤
 * `/auth/confirmed` 결과 화면("인증되었습니다")으로 보낸다.
 *
 * token_hash 방식은 reset-password 와 같은 **브라우저 독립** 경로다 — 가입한
 * 브라우저가 아닌 곳(메일앱 인앱 브라우저 등)에서 열어도 통한다.
 */
const ALLOWED_TYPES = new Set(['signup', 'email_change', 'email'] as const)
type OtpType = 'signup' | 'email_change' | 'email'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type') ?? 'signup'
  const type = (ALLOWED_TYPES.has(rawType as OtpType) ? rawType : 'signup') as OtpType

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/auth/confirmed?error=missing`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    // 가장 흔한 경우: 링크 만료(1시간) 또는 이미 사용된 링크 재클릭.
    Sentry.addBreadcrumb({
      category: 'auth',
      level: 'info',
      message: 'email confirm failed',
      data: { type, status: error.status, message: error.message },
    })
    return NextResponse.redirect(`${origin}/auth/confirmed?error=expired`)
  }

  return NextResponse.redirect(`${origin}/auth/confirmed`)
}
