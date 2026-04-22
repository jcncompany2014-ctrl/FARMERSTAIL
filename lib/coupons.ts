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
