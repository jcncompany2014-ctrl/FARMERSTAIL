import { Gift, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * WelcomeCouponBanner — 첫 구매가 없는 사용자에게 환영 쿠폰 노출.
 *
 * 동작
 * ────
 * 1. 사용자가 결제 완료 주문이 0건이면 표시 (= 신규 회원)
 * 2. admin 이 `coupons` 테이블에 `is_welcome=false` BUT 코드 'WELCOME10'
 *    같은 환영 쿠폰을 만들어두면 자동 노출. 코드는 ENV 로 설정 가능 —
 *    `NEXT_PUBLIC_WELCOME_COUPON_CODE` 우선, fallback 'WELCOME10'.
 * 3. 해당 쿠폰이 존재 + 활성 + 미만료여야 banner 가 뜸. 없으면 banner 도 없음.
 *
 * 주의: 이 컴포넌트는 server component. user 가 로그인되어 있고 결제 0건일
 * 때만 호출하는 자리에 두는 게 효율적 (예: /account, /dashboard).
 */
export default async function WelcomeCouponBanner({
  userId,
}: {
  userId: string
}) {
  const supabase = await createClient()

  // 1) 결제 완료 주문이 1건이라도 있으면 환영 쿠폰 안 보여줌.
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('payment_status', 'paid')

  if ((count ?? 0) > 0) return null

  // 2) 환영 쿠폰 picking — admin 의 audience_type 우선, ENV fallback.
  //
  // 우선순위:
  //  a) coupons 테이블에서 audience_type='first_signup' + 활성 + 미만료 중
  //     가장 최근에 만든 한 건 (= 운영자가 admin 에서 명시 지정한 것)
  //  b) ENV NEXT_PUBLIC_WELCOME_COUPON_CODE 또는 fallback 'WELCOME10' 으로
  //     특정 코드 lookup (= 이전 hard-coded 방식 호환)
  //
  // 솔로 운영자가 admin 에서 audience='first_signup' 쿠폰 활성화하면 ENV
  // 안 만져도 자동 매칭. 환영 쿠폰이 없으면 banner 자체가 렌더 안 됨.
  let coupon: {
    code: string
    name: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    min_order_amount: number
    is_active: boolean
    expires_at: string | null
  } | null = null

  const audienceResult = await supabase
    .from('coupons')
    .select(
      'code, name, discount_type, discount_value, min_order_amount, is_active, expires_at',
    )
    .eq('audience_type', 'first_signup')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  coupon = audienceResult.data

  if (!coupon) {
    const fallbackCode =
      process.env.NEXT_PUBLIC_WELCOME_COUPON_CODE ?? 'WELCOME10'
    const fallbackResult = await supabase
      .from('coupons')
      .select(
        'code, name, discount_type, discount_value, min_order_amount, is_active, expires_at',
      )
      .eq('code', fallbackCode)
      .maybeSingle()
    coupon = fallbackResult.data
  }

  if (!coupon || !coupon.is_active) return null

  // 만료 체크.
  //
  // 이 컴포넌트는 server component (async function + supabase server client) 라
  // 매 요청마다 새 스냅샷으로 한 번만 실행된다. React 19 `react-hooks/purity`
  // 룰은 client/server 를 구분 못 해 false-positive 를 내지만, 여기선 hydration
  // mismatch 도 cascading render 도 발생하지 않는다.
  // eslint-disable-next-line react-hooks/purity
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return null
  }

  const discountLabel =
    coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : `${Number(coupon.discount_value).toLocaleString('ko-KR')}원 할인`

  return (
    <div
      className="rounded-2xl px-5 py-5 md:px-7 md:py-6 mb-6 md:mb-8"
      style={{ background: 'var(--gold)', color: 'var(--ink)' }}
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 inline-flex w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center"
          style={{ background: 'var(--ink)' }}
        >
          <Gift
            className="w-4 h-4 md:w-5 md:h-5"
            strokeWidth={2}
            color="var(--gold)"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[10px] md:text-[11px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--ink)', opacity: 0.65 }}
          >
            첫 구매 전용 쿠폰
          </div>
          <h2
            className="font-serif mt-1 text-[18px] md:text-[24px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            {coupon.name ?? '환영 쿠폰'} · {discountLabel}
          </h2>
          {coupon.min_order_amount ? (
            <p
              className="mt-1 text-[11.5px] md:text-[13px]"
              style={{ color: 'var(--ink)', opacity: 0.78 }}
            >
              {Number(coupon.min_order_amount).toLocaleString('ko-KR')}원 이상
              주문 시 결제 단계에서 자동 적용돼요.
            </p>
          ) : (
            <p
              className="mt-1 text-[11.5px] md:text-[13px]"
              style={{ color: 'var(--ink)', opacity: 0.78 }}
            >
              결제 단계에서 자동으로 적용돼요.
            </p>
          )}
          {/* code 칩은 일부러 제거 — 사용자는 자동 적용을 신뢰하면 되고,
              raw 쿠폰 코드 (WELCOME10 등) 가 banner 에 큼지막하게 노출되면
              "이걸 어디다 입력해야 하지?" 라는 혼란만 늘림. */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-[12px] md:text-[13px] font-bold underline underline-offset-2"
              style={{ color: 'var(--ink)' }}
            >
              지금 쇼핑하기
              <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
