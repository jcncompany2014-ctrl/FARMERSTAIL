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

  // 2) 환영 쿠폰 메타. ENV → DB 순.
  const code =
    process.env.NEXT_PUBLIC_WELCOME_COUPON_CODE ?? 'WELCOME10'

  const { data: coupon } = await supabase
    .from('coupons')
    .select('code, name, discount_type, discount_value, min_order_amount, is_active, expires_at')
    .eq('code', code)
    .maybeSingle()

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
              주문 시 사용 가능. 체크아웃에서 코드 입력.
            </p>
          ) : (
            <p
              className="mt-1 text-[11.5px] md:text-[13px]"
              style={{ color: 'var(--ink)', opacity: 0.78 }}
            >
              체크아웃에서 코드 입력 시 자동 적용돼요.
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <code
              className="px-3 py-1.5 rounded-lg font-mono text-[12px] md:text-[13.5px] font-bold tracking-wider"
              style={{ background: 'var(--ink)', color: 'var(--gold)' }}
            >
              {coupon.code}
            </code>
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
