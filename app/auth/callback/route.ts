import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { pickKakaoBirthYear } from '@/lib/auth/kakaoProfile'

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
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\') &&
    // R101-B: /api 경로 redirect 금지 (인증 직후 GET 으로 부작용 엔드포인트 유도 방어).
    !next.startsWith('/api')
      ? next
      : '/dashboard'

  // 만 14세 게이트 — OAuth (카카오/Apple) 가입자는 birth_year 가 비어 있을
  // 수 있다. 개인정보보호법 제22조의2 (만 14세 미만 차단) 강제. 기준 연도
  // 미입력이면 onboarding 으로 redirect 하여 입력 강제 — 입력 전엔 dashboard
  // 진입 불가. (이메일 가입은 form 자체가 birth_year 강제라 영향 없음.)
  //
  // R90-E H1 (D7): deleted_at 가드 추가. account/delete 흐름은 admin.deleteUser
  // (soft) 가 auth.users.banned_until=infinity 로 막지만, 운영자가 SQL editor
  // 에서 profiles.deleted_at 만 set 한 경우 (account_purge cron 이전 단계)
  // OAuth 로그인은 그대로 통과. 여기서 deleted_at 도 함께 검사.
  const supabaseAfter = await createClient()
  const {
    data: { user },
  } = await supabaseAfter.auth.getUser()
  if (user) {
    const { data: profile } = await supabaseAfter
      .from('profiles')
      .select('birth_year, deleted_at')
      .eq('id', user.id)
      .maybeSingle()
    // 탈퇴 처리된 계정 — 즉시 signOut + 안내 화면.
    if (profile?.deleted_at) {
      await supabaseAfter.auth.signOut()
      return NextResponse.redirect(
        `${origin}/login?error=oauth_account_deleted`,
      )
    }

    // 카카오 동의항목(출생연도) → profiles.birth_year 멱등 write. 승인되면 OIDC
    // 메타데이터로 실려 온다 → 비어 있으면만 채우고, 없으면 null → age-gate 폴백.
    // ★전화번호는 카카오 심사 반려(가입 단계 미수집)로 동의항목에서 제외(2026-07-23).
    //   전화번호는 주문/배송 주소폼에서 수집. 나중에 가입-수집 전환 시 pickKakaoPhone
    //   (lib/auth/kakaoProfile.ts 보존)을 여기 재연결하면 된다.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const patch: { birth_year?: number } = {}
    if (!profile?.birth_year) {
      const by = pickKakaoBirthYear(meta, new Date().getFullYear())
      if (by) patch.birth_year = by
    }
    if (patch.birth_year != null) {
      // 실패해도(under-14 트리거/네트워크) 로그인은 진행 — 폴백이 있다.
      await supabaseAfter.from('profiles').update(patch).eq('id', user.id)
    }

    const hasBirthYear = !!profile?.birth_year || patch.birth_year != null
    // 카카오 간편가입(Kakao Sync)은 '만 14세 이상' 동의로 14세 미만 가입을
    // 이미 차단하므로 앱 age-gate 는 중복 → 카카오 가입자는 건너뛴다. 애플 등
    // 나이 미검증 provider 는 게이트로 birth_year(=14세 확인) 를 계속 강제.
    // ⚠️ 이 스킵은 Kakao Sync 의 '만 14세 이상' **필수** 동의가 활성일 때만
    //    법적으로 유효(개인정보보호법 제22조의2). 비활성화하면 재연결 필요.
    const oauthProvider =
      (user.app_metadata?.provider as string | undefined) ?? ''
    if (!hasBirthYear && oauthProvider !== 'kakao') {
      const target =
        '/onboarding/age-gate?next=' + encodeURIComponent(safeNext)
      return NextResponse.redirect(`${origin}${target}`)
    }
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
