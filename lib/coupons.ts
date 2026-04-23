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
 * 현재 구조는 insert + update 가 분리돼 있어 두 호출 사이에 서버가 죽으면
 * redemption만 남고 카운터가 안 오를 수 있다. D2C 규모에서는 실제로 문제가
 * 된 적이 없어 RPC로 합치는 건 미뤘다. 순서는 "redemption 먼저 insert → 성공
 * 시 카운터 증가" — 반대로 하면 "사용량만 올라가고 누가 썼는지 모름" 이라는
 * 더 나쁜 상태가 될 수 있어서.
 */
export async function applyCouponRedemption(
  supabase: SupabaseClient,
  input: { coupon: Coupon; userId: string; orderId: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { coupon, userId, orderId } = input
  const { error: redemptionError } = await supabase
    .from('coupon_redemptions')
    .insert({ coupon_id: coupon.id, user_id: userId, order_id: orderId })
  if (redemptionError) {
    return { ok: false, reason: redemptionError.message }
  }
  const { error: bumpError } = await supabase
    .from('coupons')
    .update({ used_count: coupon.used_count + 1 })
    .eq('id', coupon.id)
  if (bumpError) {
    return { ok: false, reason: bumpError.message }
  }
  return { ok: true }
}

/**
 * 주문 취소 시 used_count 감소. redemption 행은 "누가 언제 썼다가 취소됐는지"
 * 감사를 위해 남긴다.
 *
 * used_count 는 unsigned 개념이므로 `Math.max(0, ...)` 로 언더플로 방지.
 * 쿠폰 코드가 실제 coupons 테이블에 없으면 조용히 pass — 삭제된 쿠폰일 수 있음.
 */
export async function revokeCouponRedemption(
  supabase: SupabaseClient,
  input: { couponCode: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, used_count')
    .eq('code', input.couponCode)
    .maybeSingle()
  if (!coupon) return { ok: true }
  const { error } = await supabase
    .from('coupons')
    .update({ used_count: Math.max(0, coupon.used_count - 1) })
    .eq('id', coupon.id)
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
