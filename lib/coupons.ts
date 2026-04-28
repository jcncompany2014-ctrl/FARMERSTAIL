/**
 * Farmer's Tail — 쿠폰 로직 모음.
 *
 * - `computeCouponDiscount` : 할인 금액 계산(정책).
 * - `validateCoupon`        : 사용 가능성 검증(만료/사용량/본인 사용 제한 등).
 * - `applyCouponRedemption` : 주문 생성 시 coupon_redemptions insert + used_count 증가.
 * - `revokeCouponRedemption`: 주문 취소 시 used_count 감소. redemption 행은 감사 목적으로 보존.
 *
 * 여태까지 체크아웃/주문취소 곳곳에 `insert + update used_count` 패턴이 복붙돼
 * 있어, 한 곳을 고치면 다른 곳도 같이 고쳐야 했다. 모든 호출처가 이 파일만
 * 바라보도록 통일.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Coupon = {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount: number | null
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  used_count: number
  per_user_limit: number | null
  is_active: boolean
}

export type CouponValidation =
  | { ok: true; coupon: Coupon; discount: number }
  | { ok: false; reason: string }

export function computeCouponDiscount(coupon: Coupon, subtotal: number): number {
  if (subtotal < coupon.min_order_amount) return 0
  let discount =
    coupon.discount_type === 'percent'
      ? Math.floor((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value
  if (coupon.max_discount && discount > coupon.max_discount) {
    discount = coupon.max_discount
  }
  if (discount > subtotal) discount = subtotal
  return discount
}

export async function validateCoupon(
  supabase: SupabaseClient,
  code: string,
  subtotal: number,
  userId: string
): Promise<CouponValidation> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { ok: false, reason: '쿠폰 코드를 입력해주세요' }

  const { data: coupon } = await supabase
    .from('coupons')
    .select(
      'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, is_active'
    )
    .eq('code', normalized)
    .maybeSingle()

  if (!coupon) return { ok: false, reason: '존재하지 않는 쿠폰 코드예요' }
  if (!coupon.is_active) return { ok: false, reason: '사용할 수 없는 쿠폰이에요' }

  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { ok: false, reason: '아직 사용할 수 없는 쿠폰이에요' }
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return { ok: false, reason: '만료된 쿠폰이에요' }
  }
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, reason: '쿠폰이 모두 소진됐어요' }
  }
  if (subtotal < coupon.min_order_amount) {
    return {
      ok: false,
      reason: `${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능해요`,
    }
  }

  // per-user usage
  if (coupon.per_user_limit !== null) {
    const { count } = await supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
    if ((count ?? 0) >= coupon.per_user_limit) {
      return { ok: false, reason: '이미 사용하신 쿠폰이에요' }
    }
  }

  const discount = computeCouponDiscount(coupon as Coupon, subtotal)
  if (discount <= 0) {
    return { ok: false, reason: '이 주문 금액엔 적용할 수 없어요' }
  }

  return { ok: true, coupon: coupon as Coupon, discount }
}

/**
 * 주문 생성 시 쿠폰 사용 기록 + used_count 증가.
 *
 * 내부적으로 `redeem_coupon` Postgres RPC 호출 — 단일 트랜잭션 + 행 잠금
 * (`SELECT ... FOR UPDATE`) 으로 동시 redemption / usage_limit 초과를 차단.
 * 같은 (coupon_id, order_id) 가 이미 있으면 unique index 가 잡고 함수가
 * `already_redeemed` 로 멱등 처리 — webhook 두 번 들어와도 한 번만 적용.
 */
export async function applyCouponRedemption(
  supabase: SupabaseClient,
  input: { coupon: Coupon; userId: string; orderId: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { coupon, userId, orderId } = input
  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_coupon_id: coupon.id,
    p_user_id: userId,
    p_order_id: orderId,
  })
  if (error) return { ok: false, reason: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, reason: 'rpc_returned_no_row' }
  if (row.ok === false) {
    return { ok: false, reason: row.message ?? '쿠폰 적용에 실패했어요' }
  }
  return { ok: true }
}

/**
 * 주문 취소 시 used_count 감소. redemption 행은 "누가 언제 썼다가 취소됐는지"
 * 감사를 위해 남긴다.
 *
 * `revoke_coupon_redemption` RPC 사용 — 행 잠금 + 언더플로 방지가
 * Postgres 측에서 처리됨. 코드 미일치는 ok 응답으로 silent pass.
 */
export async function revokeCouponRedemption(
  supabase: SupabaseClient,
  input: { couponCode: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('revoke_coupon_redemption', {
    p_coupon_code: input.couponCode,
  })
  if (error) return { ok: false, reason: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.ok === false) {
    return { ok: false, reason: row?.message ?? '쿠폰 취소에 실패했어요' }
  }
  return { ok: true }
}
