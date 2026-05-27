/**
 * Farmer's Tail — Referral 시스템 helper (기존 RPC 래퍼).
 *
 * 기존 인프라:
 *   - `referral_codes`        — 자동 생성 (R-이전 라운드)
 *   - `referral_redemptions`  — redeem_referral_code RPC
 *   - `referral_milestone_rewards` + `issue_referral_milestones()` cron — 5/10/20명 보상
 *   - 초대자: 가입 즉시 5,000P (referral) + milestone 보상
 *
 * 이 모듈이 추가하는 것:
 *   - 코드 형식 검증 (FT-XXXXXX 또는 8자 영숫자)
 *   - 피초대자 환영 쿠폰 발급 (REFER_FRIEND_5000)
 *   - cookie 상수 (/r/[code] 진입점 → /signup?ref=CODE 흐름과 통합)
 *
 * 코드 형식: 기존 시스템은 8자 영숫자, 신규 /r/ 진입점은 그 외도 거부 안 함
 * (RPC 가 자체 검증). 여기선 길이/문자만 sanity check.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** 피초대자 환영 쿠폰 코드 */
export const REFER_FRIEND_COUPON_CODE = 'REFER_FRIEND_5000'

/** Cookie 이름 — /r/[code] 진입 시 set, signup 에서 fallback 으로 읽음 */
export const REFERRAL_COOKIE_NAME = 'ft_ref'

/** Cookie 유효 기간 (초) — 30일 */
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

/**
 * 코드 형식 sanity check. 영숫자 4-16자.
 *
 * 기존 코드 생성 RPC 는 8자 정도를 만들지만 형식이 정확히 어떻게 정해진지는
 * application 입장에서 알 필요 없음 — RPC 가 INVALID CODE 로 거부함.
 * 여기선 명백한 잘못된 입력 (특수문자, 너무 짧음) 만 차단.
 */
export function isLikelyReferralCode(raw: string): boolean {
  const normalized = raw.trim().toUpperCase()
  return /^[A-Z0-9-]{4,16}$/.test(normalized)
}

/**
 * 피초대자에게 REFER_FRIEND_5000 쿠폰 발급. signup 페이지에서
 * redeem_referral_code RPC 성공 직후 호출.
 *
 * - audience='manual' 쿠폰을 manual_coupon_grants 에 1:1 발급
 * - 멱등: 같은 user 두 번 호출되어도 ON CONFLICT 로 silent
 * - RLS 우회 필요 — service_role 클라이언트로 호출하거나 RPC 통해야 함.
 *   client-side 에서는 호출 불가 (RLS 차단). 따라서 별도 API endpoint 필요.
 *
 * 실패해도 silent — referral 핵심 (초대자 5000P) 은 이미 처리됨.
 */
export async function grantRefereeWelcomeCoupon(
  supabaseAdmin: SupabaseClient,
  refereeUserId: string,
): Promise<{ ok: boolean; granted: boolean }> {
  try {
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', REFER_FRIEND_COUPON_CODE)
      .eq('is_active', true)
      .maybeSingle()

    if (!coupon) {
      return { ok: false, granted: false }
    }

    const { error: grantErr } = await supabaseAdmin
      .from('manual_coupon_grants')
      .upsert(
        {
          coupon_id: coupon.id,
          user_id: refereeUserId,
          granted_by: null,
        },
        { onConflict: 'coupon_id,user_id', ignoreDuplicates: true },
      )

    if (grantErr) {
      return { ok: false, granted: false }
    }

    return { ok: true, granted: true }
  } catch {
    return { ok: false, granted: false }
  }
}
