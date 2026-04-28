import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CouponBrowser from './CouponBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '내 쿠폰',
  robots: { index: false, follow: false },
}

export default async function CouponsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/coupons')

  const nowIso = new Date().toISOString()

  const { data: availableCoupons } = await supabase
    .from('coupons')
    .select(
      'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, per_user_limit, used_count, usage_limit'
    )
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })

  const { data: myRedemptions } = await supabase
    .from('coupon_redemptions')
    .select('coupon_id')
    .eq('user_id', user.id)

  const usedCountByCoupon = new Map<string, number>()
  for (const r of myRedemptions ?? []) {
    usedCountByCoupon.set(r.coupon_id, (usedCountByCoupon.get(r.coupon_id) ?? 0) + 1)
  }

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 block">Coupons · 쿠폰</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          내 쿠폰
        </h1>
        <p className="text-[11px] text-muted mt-1">
          체크아웃에서 쿠폰 코드를 입력하세요
        </p>
      </section>

      <CouponBrowser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        coupons={(availableCoupons ?? []) as any[]}
        usedCountByCoupon={Object.fromEntries(usedCountByCoupon)}
      />

      {(!availableCoupons || availableCoupons.length === 0) && (
        <section className="px-5 mt-6">
          <div
            className="rounded-2xl border px-6 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Ticket
                className="w-6 h-6 text-muted"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker">Empty · 쿠폰 없음</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              사용 가능한 쿠폰이 없어요
            </h3>
            <p className="text-[11px] text-muted mt-1.5">
              이벤트 쿠폰이 발급되면 이곳에 표시돼요
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
