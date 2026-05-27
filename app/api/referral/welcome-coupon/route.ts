/**
 * POST /api/referral/welcome-coupon — 친구 초대 환영 쿠폰 발급 endpoint.
 *
 * Flow:
 *   1. 인증된 사용자만 (본인 세션)
 *   2. referral_redemptions 에 본인이 referee 인 row 가 있는지 확인
 *   3. 있으면 REFER_FRIEND_5000 쿠폰을 manual_coupon_grants 에 1:1 발급
 *   4. 멱등 — upsert(onConflict, ignoreDuplicates) 로 중복 호출 안전
 *
 * 호출 시점:
 *   signup 페이지에서 redeem_referral_code RPC 성공 직후 fire-and-forget.
 *   실패해도 가입 흐름엔 영향 없음.
 *
 * Rate limit: 사용자당 가입 직후 1회 — 굳이 빡빡할 필요 없지만 abuse 차단
 * 차원에서 IP 당 1분 5건.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { grantRefereeWelcomeCoupon } from '@/lib/referral'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // 1. rate limit
  const rl = rateLimit({
    bucket: 'referral-welcome-coupon',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rl.headers },
    )
  }

  // 2. 인증
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  // 3. 본인이 referee 인 redemption 이 있는지 — 없으면 발급 안 함.
  // .maybeSingle() 대신 .limit(1) — 데이터 이상으로 row 2+ 생겨도 PGRST 406 미발생.
  const { data: redemptions } = await supabase
    .from('referral_redemptions')
    .select('id')
    .eq('referee_id', user.id)
    .limit(1)

  if (!redemptions || redemptions.length === 0) {
    // referral 가입 아님 — 정상. silent ok.
    return NextResponse.json({ ok: true, granted: false })
  }

  // 4. service_role 로 쿠폰 발급 (manual_coupon_grants RLS 우회)
  const admin = createAdminClient()
  const result = await grantRefereeWelcomeCoupon(admin, user.id)

  return NextResponse.json({
    ok: result.ok,
    granted: result.granted,
  })
}
