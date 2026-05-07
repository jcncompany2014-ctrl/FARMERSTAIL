import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Repeat,
  Coins,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import PrintButtonClient from './PrintButtonClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '매출 리포트 — Admin',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ year?: string; month?: string }>

/**
 * /admin/reports?year=2026&month=05 — 월별 매출 리포트.
 *
 * 솔로 창업자 세무 / 운영 리뷰용. paid orders + 정기배송 청구 + 환불 차감 →
 * 월간 net 매출. 인쇄 친화 (`@media print` 으로 깔끔하게 출력).
 *
 * # 월 선택
 * URL ?year=2026&month=05 — 미지정 시 이번 달.
 *
 * # 인쇄
 * 우측 상단 "인쇄" 버튼 — window.print() (client island).
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/reports')
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  const sp = await searchParams
  const now = new Date()
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear()
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1

  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()

  const [
    { data: paidOrders },
    { data: refunds },
    { data: subCharges },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, total_amount, points_used, discount_amount, shipping_fee, paid_at, payment_method, order_items(product_id, product_name, quantity, line_total)',
      )
      .eq('payment_status', 'paid')
      .gte('paid_at', monthStart)
      .lt('paid_at', monthEnd)
      .order('paid_at', { ascending: false }),
    supabase
      .from('refunds')
      .select('amount, refunded_at, is_partial')
      .eq('status', 'succeeded')
      .gte('refunded_at', monthStart)
      .lt('refunded_at', monthEnd),
    supabase
      .from('subscription_charges')
      .select('amount, attempted_at, status')
      .eq('status', 'succeeded')
      .gte('attempted_at', monthStart)
      .lt('attempted_at', monthEnd),
  ])

  type Order = {
    id: string
    total_amount: number
    points_used: number
    discount_amount: number
    shipping_fee: number
    paid_at: string
    payment_method: string | null
    order_items: Array<{
      product_id: string
      product_name: string
      quantity: number
      line_total: number
    }> | null
  }
  const orders = (paidOrders ?? []) as Order[]
  const refundList = (refunds ?? []) as Array<{
    amount: number
    refunded_at: string
    is_partial: boolean
  }>
  const charges = (subCharges ?? []) as Array<{ amount: number }>

  const grossRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const refundTotal = refundList.reduce((s, r) => s + r.amount, 0)
  const netRevenue = grossRevenue - refundTotal
  const orderCount = orders.length
  const subRevenue = charges.reduce((s, c) => s + c.amount, 0)
  const subCount = charges.length
  const aov = orderCount > 0 ? Math.round(grossRevenue / orderCount) : 0
  const totalShipping = orders.reduce(
    (s, o) => s + (o.shipping_fee ?? 0),
    0,
  )
  const totalDiscount = orders.reduce(
    (s, o) => s + (o.discount_amount ?? 0),
    0,
  )
  const totalPointsUsed = orders.reduce(
    (s, o) => s + (o.points_used ?? 0),
    0,
  )

  // Top 5 상품 (수량 기준)
  const productSales = new Map<
    string,
    { name: string; qty: number; revenue: number }
  >()
  for (const o of orders) {
    for (const it of o.order_items ?? []) {
      const cur = productSales.get(it.product_id) ?? {
        name: it.product_name,
        qty: 0,
        revenue: 0,
      }
      cur.qty += it.quantity
      cur.revenue += it.line_total
      productSales.set(it.product_id, cur)
    }
  }
  const topProducts = Array.from(productSales.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // 결제수단 비율
  const methodCount = new Map<string, number>()
  for (const o of orders) {
    const m = o.payment_method ?? '미상'
    methodCount.set(m, (methodCount.get(m) ?? 0) + 1)
  }

  // 이전/다음 달 navigate
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevHref = `/admin/reports?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`
  const nextHref = `/admin/reports?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`

  return (
    <div className="px-5 py-6 print:px-0 print:py-0">
      {/* print 시에만 적용되는 styles */}
      <style>
        {`@media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }`}
      </style>

      <div className="flex items-end justify-between mb-6 no-print">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
            대시보드
          </Link>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-moss" strokeWidth={2} />
            <h1 className="font-['Archivo_Black'] text-2xl text-ink">
              REVENUE REPORT
            </h1>
          </div>
          <p className="text-[12px] text-muted mt-1">
            월별 매출 / 환불 / 정기배송 / Top 상품
          </p>
        </div>
        <PrintButtonClient />
      </div>

      {/* 월 navigate */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text" strokeWidth={2} />
          <span
            className="font-serif"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {year}년 {month}월 리포트
          </span>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Link
            href={prevHref}
            className="px-3 py-1.5 rounded-lg bg-white border border-rule text-[11px] font-bold hover:border-text transition"
          >
            ← 이전 달
          </Link>
          <Link
            href={nextHref}
            className="px-3 py-1.5 rounded-lg bg-white border border-rule text-[11px] font-bold hover:border-text transition"
          >
            다음 달 →
          </Link>
        </div>
      </div>

      {/* Hero 매출 카드 */}
      <section
        className="rounded-2xl px-6 py-5 text-white mb-5 print:break-inside-avoid"
        style={{
          background:
            'linear-gradient(135deg, var(--ink) 0%, #3a2f1d 60%, #5b4720 100%)',
        }}
      >
        <span className="kicker kicker-gold">Net Revenue · 순매출</span>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span
            className="font-serif leading-none tabular-nums text-gold"
            style={{
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: '-0.025em',
            }}
          >
            {netRevenue.toLocaleString()}
          </span>
          <span className="text-[16px] text-white/85 font-bold">원</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <span className="text-white/60">매출 (gross)</span>
            <div className="font-bold text-white tabular-nums">
              {grossRevenue.toLocaleString()}원
            </div>
          </div>
          <div>
            <span className="text-white/60">환불</span>
            <div className="font-bold text-white tabular-nums">
              -{refundTotal.toLocaleString()}원
            </div>
          </div>
        </div>
      </section>

      {/* stat 4-grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:break-inside-avoid">
        <ReportStat
          kicker="주문 건수"
          value={orderCount}
          unit="건"
          Icon={ShoppingBag}
          tone="ink"
        />
        <ReportStat
          kicker="평균 주문가"
          value={aov}
          unit="원"
          Icon={Coins}
          tone="terracotta"
        />
        <ReportStat
          kicker="정기배송"
          value={subCount}
          unit="건"
          sub={`${subRevenue.toLocaleString()}원`}
          Icon={Repeat}
          tone="moss"
        />
        <ReportStat
          kicker="배송비 수입"
          value={totalShipping}
          unit="원"
          Icon={ShoppingBag}
          tone="muted"
        />
      </section>

      {/* 차감 합계 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-4 mb-6 print:break-inside-avoid">
        <span className="kicker kicker-muted">Deductions · 차감</span>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
          <div>
            <span className="text-muted">쿠폰 할인</span>
            <div className="font-bold tabular-nums text-text">
              -{totalDiscount.toLocaleString()}원
            </div>
          </div>
          <div>
            <span className="text-muted">포인트 사용</span>
            <div className="font-bold tabular-nums text-text">
              -{totalPointsUsed.toLocaleString()}원
            </div>
          </div>
          <div>
            <span className="text-muted">환불</span>
            <div className="font-bold tabular-nums text-sale">
              -{refundTotal.toLocaleString()}원
            </div>
          </div>
        </div>
      </section>

      {/* Top 5 상품 */}
      {topProducts.length > 0 && (
        <section className="mb-6 print:break-inside-avoid">
          <span className="kicker mb-2 block">Top Products · 인기 상품</span>
          <ol className="bg-white rounded-xl border border-rule overflow-hidden">
            {topProducts.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < topProducts.length - 1 ? 'border-b border-rule' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-[11px] text-white"
                    style={{
                      background:
                        i === 0
                          ? 'var(--terracotta)'
                          : i === 1
                            ? 'var(--moss)'
                            : 'var(--muted)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-bold text-text truncate">
                    {p.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold text-terracotta tabular-nums">
                    {p.revenue.toLocaleString()}원
                  </div>
                  <div className="text-[10px] text-muted tabular-nums">
                    {p.qty}개 판매
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 결제수단 분포 */}
      {methodCount.size > 0 && (
        <section className="mb-6 print:break-inside-avoid">
          <span className="kicker mb-2 block">
            Payment Methods · 결제수단
          </span>
          <div className="bg-white rounded-xl border border-rule px-4 py-3">
            {Array.from(methodCount.entries()).map(([method, count]) => {
              const pct =
                orderCount > 0 ? Math.round((count / orderCount) * 100) : 0
              return (
                <div key={method} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11.5px] font-bold text-text">
                      {method}
                    </span>
                    <span className="text-[10.5px] text-muted tabular-nums">
                      {count}건 · {pct}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: 'var(--terracotta)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <p className="text-[10px] text-muted text-center mt-8 no-print">
        * 본 리포트는 paid orders + succeeded refunds 기준. 입금 대기 (가상계좌)
        는 paid_at 기준으로 자동 합산. 인쇄 시 페이지별 카드 break 방지.
      </p>
    </div>
  )
}

function ReportStat({
  kicker,
  value,
  unit,
  sub,
  Icon,
  tone,
}: {
  kicker: string
  value: number
  unit: string
  sub?: string
  Icon: typeof TrendingUp
  tone: 'ink' | 'terracotta' | 'moss' | 'muted'
}) {
  const colorMap = {
    ink: 'var(--ink)',
    terracotta: 'var(--terracotta)',
    moss: 'var(--moss)',
    muted: 'var(--muted)',
  }
  const accent = colorMap[tone]
  return (
    <div className="bg-white rounded-xl border border-rule px-4 py-3.5">
      <div className="flex items-center gap-1">
        <Icon
          className="w-3 h-3"
          style={{ color: accent }}
          strokeWidth={2.5}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {kicker}
        </span>
      </div>
      <div
        className="mt-1 font-serif tabular-nums"
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
        }}
      >
        {value.toLocaleString()}
        <span className="text-[10px] text-muted ml-0.5 font-sans">
          {unit}
        </span>
      </div>
      {sub && (
        <div className="text-[10px] text-muted mt-0.5 tabular-nums">{sub}</div>
      )}
    </div>
  )
}

