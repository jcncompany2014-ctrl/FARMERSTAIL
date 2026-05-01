import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * OAuth callback handler.
 *
 * Flow: Kakao → Supabase `/auth/v1/callback` → here (with `code` param)
 * → exchange code for session → redirect to `next` (default: /dashboard).
 *
 * # 에러 처리 정책
 *
 * 모든 실패는 Sentry 에 컨텍스트 (provider, step, raw error) 와 함께 보내고,
 * 사용자에겐 안정된 짧은 코드 (`?error=oauth_provider_denied` 등) 만 노출.
 * /login 페이지가 코드를 한국어 카피로 매핑해서 보여준다 — raw provider
 * 메시지가 사용자에게 노출되는 일 차단 (URL 에 PII 가 섞일 가능성도 제거).
 *
 * # 안정 에러 코드 (login 페이지와 SSOT)
 *
 *   oauth_provider_denied  — 사용자가 카카오 화면에서 "취소" 누름
 *   oauth_missing_code     — provider 가 code 없이 redirect (설정 오류 가능)
 *   oauth_exchange_failed  — Supabase code→session 교환 실패 (만료/스푸핑)
 *   oauth_unexpected       — 기타 예외 (Sentry 에서 raw 정보 확인)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Provider 추적 — Sentry tag 용. Supabase 가 callback URL 에 provider 를
  // 직접 알리지 않으므로 referer 또는 Supabase session 사후 검사로 추정 가능.
  // 일단 'oauth' 일반화 — 정확한 분리가 필요하면 OAuth state param 에 인코딩.
  const provider = 'oauth'

  if (errorParam) {
    // 사용자가 카카오 동의 화면에서 "취소" 누른 케이스가 가장 흔함
    // (`error=access_denied`). Sentry 에 info 레벨로만 — 실제 결함 아님.
    Sentry.addBreadcrumb({
      category: 'auth',
      level: 'info',
      message: 'oauth provider returned error',
      data: { provider, errorParam, errorDescription },
    })
    const code =
      errorParam === 'access_denied'
        ? 'oauth_provider_denied'
        : 'oauth_provider_error'
    return NextResponse.redirect(`${origin}/login?error=${code}`)
  }

  if (!code) {
    Sentry.captureMessage('oauth callback: missing code', {
      level: 'warning',
      tags: { provider, step: 'incoming' },
    })
    return NextResponse.redirect(`${origin}/login?error=oauth_missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // 가장 흔한 케이스: 코드 만료 (사용자가 한참 후 새 탭에서 재방문),
    // 또는 다른 IP/디바이스 에서 한 번 쓴 코드 재사용 (CSRF 보호 발동).
    Sentry.captureException(error, {
      tags: { provider, step: 'exchange' },
      extra: {
        // 코드 자체는 절대 로깅 금지 (재사용 가능 토큰).
        message: error.message,
        status: error.status,
      },
    })
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`)
  }

  // Prevent open-redirect: only allow internal paths.
  // `next=//evil.com` 은 startsWith('/') 도 true 지만 startsWith('//') 도 true →
  // 두 번째 조건이 false 가 되어 fallback. backslash 변형 (`/\evil.com`) 도
  // 함께 차단.
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
      ? next
      : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
