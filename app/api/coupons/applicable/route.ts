import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { computeCouponDiscount, type Coupon } from '@/lib/coupons'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/coupons/applicable?subtotal=N
 *
 * 현재 주문 금액 기준으로 사용자가 사용 가능한 쿠폰 list 를 반환.
 * 체크아웃 페이지가 mount 시 호출 → "사용 가능한 쿠폰 N장" 시그널 + 시트
 * 안에서 카드 list 표시 + 가장 큰 할인 자동 추천.
 *
 * # Response
 *  {
 *    available: Coupon[]  — 적용 가능 (조건 충족, per_user_limit 안 넘음)
 *    unavailable: { coupon: Coupon, reason: string, hint?: string }[]
 *      — 보유는 했으나 조건 미충족 (예: "5,000원 더 담으면 사용 가능")
 *    bestDealId: string | null — 가장 큰 할인 쿠폰 id
 *  }
 *
 * # Filter
 *  - is_active=true
 *  - expires_at > NOW (또는 NULL)
 *  - usage_limit > used_count (전체 한도 안 찼음)
 *  - per_user_limit 안 넘음 (사용자 본인의 redemption 카운트로 비교)
 *
 * # 보안
 *  - 본인 인증 필수 (auth getUser)
 *  - rate limit (분당 30) — UI 가 mount 시 1회 호출이라 충분
 */

const querySchema = z.object({
  subtotal: z.coerce.number().int().nonnegative(),
})

export async function GET(req: Request) {
  const rl = rateLimit({
    bucket: 'coupons-applicable',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    subtotal: url.searchParams.get('subtotal'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'INVALID_QUERY', message: 'subtotal 이 필요해요' },
      { status: 400 },
    )
  }
  const subtotal = parsed.data.subtotal

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  const nowIso = new Date().toISOString()

  // 활성 + 미만료 쿠폰 + 전체 한도 미달인 것만.
  const { data: coupons, error } = await supabase
    .from('coupons')
    .select(
      'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, usage_limit, used_count, per_user_limit, is_active, audience_type',
    )
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

  if (error) {
    return dbError(error, 'coupons_applicable', '쿠폰을 불러오지 못했어요')
  }

  // 사용자 본인의 redemption 카운트 — per_user_limit 비교용.
  const { data: redemptions } = await supabase
    .from('coupon_redemptions')
    .select('coupon_id')
    .eq('user_id', user.id)
  const usedByUser = new Map<string, number>()
  for (const r of redemptions ?? []) {
    usedByUser.set(r.coupon_id, (usedByUser.get(r.coupon_id) ?? 0) + 1)
  }

  // 첫 구매 전용 쿠폰 필터용 — 본인 paid 주문 수 (0 이면 첫 구매자).
  const { count: paidOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('payment_status', 'paid')
  const isFirstTimeBuyer = (paidOrderCount ?? 0) === 0

  type Bucket = {
    coupon: Coupon
    discount: number
  }
  const available: Bucket[] = []
  const unavailable: Array<{
    coupon: Coupon
    reason: 'min_order' | 'no_discount' | 'limit_reached'
    hint?: string
  }> = []

  for (const raw of coupons ?? []) {
    const c = raw as Coupon
    // 전체 사용 한도 초과
    if (c.usage_limit !== null && c.used_count >= c.usage_limit) continue
    // 첫 구매 전용인데 이미 구매 이력 있으면 본인 쿠폰 아님 → 목록에서 제외.
    if (c.audience_type === 'first_signup' && !isFirstTimeBuyer) continue
    // 본인 사용 한도 초과 → 사용 완료로 간주, 응답에 안 포함 (mypage 와 분리)
    const userUsed = usedByUser.get(c.id) ?? 0
    if (c.per_user_limit !== null && userUsed >= c.per_user_limit) {
      unavailable.push({ coupon: c, reason: 'limit_reached' })
      continue
    }
    // 최소 주문 금액 미달
    if (subtotal < c.min_order_amount) {
      const need = c.min_order_amount - subtotal
      unavailable.push({
        coupon: c,
        reason: 'min_order',
        hint: `${need.toLocaleString()}원 더`,
      })
      continue
    }
    // 할인 금액 계산 — 0 이면 적용 의미 없음
    const discount = computeCouponDiscount(c, subtotal)
    if (discount <= 0) {
      unavailable.push({ coupon: c, reason: 'no_discount' })
      continue
    }
    available.push({ coupon: c, discount })
  }

  // 가장 큰 할인 추천 (best deal).
  available.sort((a, b) => b.discount - a.discount)
  const bestDealId = available[0]?.coupon.id ?? null

  return NextResponse.json({
    available: available.map((b) => ({
      ...b.coupon,
      _expectedDiscount: b.discount,
    })),
    unavailable: unavailable.map((u) => ({
      coupon: u.coupon,
      reason: u.reason,
      hint: u.hint ?? null,
    })),
    bestDealId,
  })
}
