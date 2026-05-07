import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CouponBrowser from './CouponBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '내 쿠폰',
  robots: { index: false, follow: false },
}

/**
 * /mypage/coupons — 쿠폰함 (탭: 사용 가능 / 사용 완료 / 만료).
 *
 * Fetch:
 *  - 활성 + 미만료 쿠폰 (사용 가능 후보)
 *  - 만료된 쿠폰 (최근 30일 내) — "기한 만료" 표시
 *  - 사용자 본인의 redemptions — per_user_limit 도달분 = 사용 완료
 *
 * 본인 redemptions 와 쿠폰을 결합해서 client 가 탭별로 분기.
 */
export default async function CouponsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/coupons')

  // Server component 매 요청마다 실행 — Date.now 사용 정상이지만
  // react-hooks/purity 룰이 hook 가정으로 잡음. force-dynamic 이라 캐시 X.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 3600 * 1000).toISOString()

  const [{ data: activeCoupons }, { data: expiredCoupons }, { data: redemptions }] =
    await Promise.all([
      // 활성 + 미만료
      supabase
        .from('coupons')
        .select(
          'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, per_user_limit, used_count, usage_limit, is_active',
        )
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('expires_at', { ascending: true, nullsFirst: false }),
      // 최근 30일 내 만료된 것 (오래된 expired 는 노이즈)
      supabase
        .from('coupons')
        .select(
          'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, per_user_limit, used_count, usage_limit, is_active',
        )
        .lte('expires_at', nowIso)
        .gte('expires_at', thirtyDaysAgo)
        .order('expires_at', { ascending: false }),
      // 본인 redemptions
      supabase
        .from('coupon_redemptions')
        .select('coupon_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 block">Coupons · 쿠폰함</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          내 쿠폰함
        </h1>
        <p className="text-[11px] text-muted mt-1">
          체크아웃 시 사용 가능한 쿠폰이 자동으로 표시돼요
        </p>
      </section>

      <CouponBrowser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCoupons={(activeCoupons ?? []) as any[]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiredCoupons={(expiredCoupons ?? []) as any[]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        redemptions={(redemptions ?? []) as any[]}
      />
    </main>
  )
}
