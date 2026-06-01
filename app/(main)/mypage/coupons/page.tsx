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

  // audience 필터 — 쿠폰함에 노출할 audience:
  //  - 'all': 누구나
  //  - 'manual': 본인에게 발급된 grant 있는 것만 (별도 query 로 join)
  //  - 'first_signup' / 'birthday' / 'inactive_30d' / 'vip_tier': 결제 단계
  //    에서 자동 적용되므로 쿠폰함에는 노출 안 함 (이메일/배너로 안내).
  const [
    { data: publicCoupons },
    { data: expiredCoupons },
    { data: redemptions },
    { data: grantedRows },
  ] = await Promise.all([
    // 활성 + 미만료, audience='all'
    supabase
      .from('coupons')
      .select(
        'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, per_user_limit, used_count, usage_limit, is_active',
      )
      .eq('is_active', true)
      .eq('audience_type', 'all')
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
    // 본인에게 manual 발급된 grant — coupon row inner join.
    supabase
      .from('manual_coupon_grants')
      .select(
        'coupon_id, coupons!inner(id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, expires_at, per_user_limit, used_count, usage_limit, is_active)',
      )
      .eq('user_id', user.id),
  ])

  // grant 결과를 publicCoupons 와 합침. 만료/비활성 제외 + 중복 제거.
  type CouponRow = NonNullable<typeof publicCoupons>[number]
  type GrantRow = {
    coupon_id: string
    coupons: CouponRow | CouponRow[] | null
  }
  const grantedCoupons: CouponRow[] = ((grantedRows ?? []) as GrantRow[])
    .map((g) => (Array.isArray(g.coupons) ? g.coupons[0] : g.coupons))
    .filter((c): c is CouponRow => {
      if (!c || !c.is_active) return false
      if (c.expires_at && new Date(c.expires_at).getTime() < nowMs) return false
      return true
    })

  const seenIds = new Set<string>()
  const activeCoupons = [...(publicCoupons ?? []), ...grantedCoupons].filter(
    (c) => {
      if (seenIds.has(c.id)) return false
      seenIds.add(c.id)
      return true
    },
  )

  return (
    <div style={{ paddingBottom: 32 }}>
      <section style={{ padding: '24px 20px 8px' }}>
        <Link
          href="/mypage"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--ink-mute, #706854)',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 14,
          }}
        >
          ← 내 정보
        </Link>
        <div
          style={{
            fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#706854',
          }}
        >
          Coupons · 쿠폰함
        </div>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1,
            color: '#16140f',
            letterSpacing: '-0.02em',
          }}
        >
          내 쿠폰함
        </h1>
        <p
          style={{
            fontSize: 11.5,
            color: '#706854',
            marginTop: 6,
          }}
        >
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
    </div>
  )
}
