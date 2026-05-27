/**
 * GET /r/[code] — 친구 초대 링크 진입점.
 *
 * Flow:
 *   1. URL path 의 코드 sanity check (영숫자 4-16자)
 *   2. 익명 사용자 → /signup?ref=CODE (기존 signup ?ref= 흐름과 통합)
 *      로그인 사용자 → / (이미 가입했으면 referrer 보상 받을 수 없음)
 *   3. cookie ft_ref 도 set (30일) — Kakao OAuth 같은 redirect 후 복구용 fallback
 *
 * Abuse 차단:
 *   - 형식 안 맞는 코드는 cookie 안 저장하고 홈 redirect
 *   - 이미 ft_ref cookie 가 있으면 덮어쓰지 않음 (먼저 받은 초대 우선)
 *   - 자기 자신 코드는 RPC redeem_referral_code 가 자체적으로 차단
 *
 * 코드 자체의 DB 유효성은 검증 안 함 — redeem 시점 (signup 완료 시) 에 RPC 가
 * 거부함. 여기서 RPC 호출해 미리 확인하면 anonymous DB hit + race.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_MAX_AGE,
  isLikelyReferralCode,
} from '@/lib/referral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://www.farmerstail.kr'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params
  const code = rawCode.trim().toUpperCase()

  // 1. 형식 sanity check
  if (!isLikelyReferralCode(code)) {
    return NextResponse.redirect(`${SITE_URL}/`, { status: 302 })
  }

  // 2. 로그인 상태 확인 — 익명이면 /signup?ref=CODE, 로그인됐으면 홈
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let target: URL
  if (!user) {
    // 익명 — signup 페이지 (?ref= 흐름과 통합, 자동 입력됨)
    target = new URL('/signup', SITE_URL)
    target.searchParams.set('ref', code)
  } else {
    // 이미 로그인 — 친구 초대 보상은 못 받음. 홈 + 안내 query
    target = new URL('/', SITE_URL)
    target.searchParams.set('ref_already_member', '1')
  }

  const response = NextResponse.redirect(target.toString(), { status: 302 })

  // 3. cookie 도 set (Kakao OAuth roundtrip 후 fallback). 단 이미 있으면
  // 덮어쓰지 않음 — 먼저 받은 초대 우선.
  const hasExisting = req.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .some((s) => s.startsWith(`${REFERRAL_COOKIE_NAME}=`))

  if (!hasExisting && !user) {
    response.cookies.set(REFERRAL_COOKIE_NAME, code, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      httpOnly: false, // signup form 의 client JS 가 읽을 수 있도록
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  }

  return response
}
