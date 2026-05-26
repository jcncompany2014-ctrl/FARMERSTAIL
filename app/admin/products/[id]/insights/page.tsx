/**
 * XL-5 (#23) — /admin/products/[id]/insights
 *
 * SKU 별 LTV (Lifetime Value) 분석. order_items 를 통해 이 제품을 산
 * 사용자들의 총 결제 금액 / 평균 객단가 / 평균 LTV 산출.
 *
 * # 정의
 *  - "buyer" = 이 제품을 최소 1회 산 유저 (payment_status='paid')
 *  - per-buyer revenue = 그 유저의 모든 paid order total_amount 합계
 *  - SKU LTV = avg(per-buyer revenue)
 *  - SKU 단가 점유율 = (이 제품 라인 revenue) / (해당 유저 총 revenue) — 평균
 *
 * # 비즈니스 가치
 *  광고 / 프로모션 자원 배분 결정. LTV 높은 SKU 에 CAC 더 투자.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

interface OrderItemRow {
  product_id: string | null
  line_total: number | null
  quantity: number | null
  orders: {
    id: string
    user_id: string | null
    total_amount: number | null
    payment_status: string | null
    created_at: string | null
  } | null
}

export default async function ProductInsightsPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', id)
    .single()
  if (error || !product) notFound()

  // 이 제품의 모든 order_items (paid orders 만)
  const { data: itemsRaw } = await supabase
    .from('order_items')
    .select(
      `
      product_id, line_total, quantity,
      orders!inner (id, user_id, total_amount, payment_status, created_at)
    `,
    )
    .eq('product_id', id)
    .eq('orders.payment_status', 'paid')
    .limit(5000)

  const items = ((itemsRaw ?? []) as unknown) as OrderItemRow[]

  // buyer 별 집계
  type BuyerStats = {
    userId: string
    totalRevenue: number
    productRevenue: number
    orderCount: number
    productOrderCount: number
    firstOrderAt: string | null
  }
  const byBuyer = new Map<string, BuyerStats>()
  const sawOrderIds = new Set<string>()

  for (const it of items) {
    const order = it.orders
    if (!order?.user_id) continue
    const userId = order.user_id

    let stats = byBuyer.get(userId)
    if (!stats) {
      stats = {
        userId,
        totalRevenue: 0,
        productRevenue: 0,
        orderCount: 0,
        productOrderCount: 0,
        firstOrderAt: null,
      }
      byBuyer.set(userId, stats)
    }

    stats.productRevenue += it.line_total ?? 0
    stats.productOrderCount += 1
    if (
      !stats.firstOrderAt ||
      (order.created_at && order.created_at < stats.firstOrderAt)
    ) {
      stats.firstOrderAt = order.created_at
    }
    // unique order
    if (!sawOrderIds.has(order.id)) {
      sawOrderIds.add(order.id)
      stats.orderCount += 1
    }
  }

  // 이 유저들의 전체 paid order revenue (다른 제품 포함)
  const buyerIds = [...byBuyer.keys()]
  if (buyerIds.length > 0) {
    const { data: allOrdersRaw } = await supabase
      .from('orders')
      .select('user_id, total_amount, payment_status, created_at')
      .in('user_id', buyerIds)
      .eq('payment_status', 'paid')
      .limit(20000)
    const allOrders = (allOrdersRaw ?? []) as Array<{
      user_id: string
      total_amount: number | null
      created_at: string | null
    }>
    for (const o of allOrders) {
      const stats = byBuyer.get(o.user_id)
      if (!stats) continue
      stats.totalRevenue += o.total_amount ?? 0
    }
  }

  // KPIs
  const buyers = [...byBuyer.values()]
  const buyerCount = buyers.length
  const avgLtv =
    buyerCount === 0
      ? 0
      : buyers.reduce((a, b) => a + b.totalRevenue, 0) / buyerCount
  const avgProductRevenue =
    buyerCount === 0
      ? 0
      : buyers.reduce((a, b) => a + b.productRevenue, 0) / buyerCount
  const avgShare =
    avgLtv === 0 ? 0 : (avgProductRevenue / avgLtv) * 100
  const avgRepeatRate =
    buyerCount === 0
      ? 0
      : (buyers.filter((b) => b.productOrderCount >= 2).length / buyerCount) *
        100

  // Top 10 buyers by LTV
  const topBuyers = buyers
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10)

  // LTV distribution histogram (5 buckets)
  const buckets = [0, 50_000, 200_000, 500_000, 1_000_000, Infinity]
  const histogram = new Array(buckets.length - 1).fill(0)
  for (const b of buyers) {
    for (let i = 0; i < buckets.length - 1; i++) {
      if (b.totalRevenue >= buckets[i]! && b.totalRevenue < buckets[i + 1]!) {
        histogram[i]++
        break
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/products/${id}`}
          className="inline-flex items-center gap-1 text-xs text-mute hover:text-terracotta font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          제품 편집
        </Link>
        <h1 className="font-['Archivo_Black'] text-3xl text-ink mt-2">
          SKU INSIGHTS
        </h1>
        <p className="text-xs text-mute mt-1">
          {product.name} · LTV · 재구매율 · buyer 분포
        </p>
      </div>

      {/* KPI grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="구매자 수"
          value={`${buyerCount.toLocaleString()}명`}
        />
        <Kpi
          label="평균 LTV"
          value={`₩${Math.round(avgLtv).toLocaleString()}`}
          hint="이 제품 산 유저의 총 결제 평균"
        />
        <Kpi
          label="이 제품 매출 점유"
          value={`${avgShare.toFixed(1)}%`}
          hint="평균 LTV 중 이 제품 비중"
        />
        <Kpi
          label="재구매율"
          value={`${avgRepeatRate.toFixed(1)}%`}
          hint="이 제품 2회+ 구매자 비율"
        />
      </section>

      {/* LTV histogram */}
      <section className="rounded border border-line p-4 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-3">LTV 분포</h2>
        <div className="space-y-2">
          {histogram.map((count: number, i: number) => {
            const lo = buckets[i]!
            const hi = buckets[i + 1]!
            const label =
              hi === Infinity
                ? `₩${(lo / 10000).toFixed(0)}만+`
                : `₩${(lo / 10000).toFixed(0)}만 ~ ₩${(hi / 10000).toFixed(0)}만`
            const pct =
              buyerCount === 0 ? 0 : (count / buyerCount) * 100
            return (
              <div key={i} className="text-xs">
                <div className="flex justify-between mb-0.5">
                  <span className="text-ink">{label}</span>
                  <span className="text-mute">
                    {count}명 ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-paperHi rounded">
                  <div
                    className="h-2 bg-terracotta rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Top 10 buyers */}
      <section className="rounded border border-line p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">
          Top 10 buyers (LTV 기준)
        </h2>
        <table className="w-full text-xs">
          <thead className="text-mute">
            <tr className="border-b border-line">
              <th className="text-left py-2 px-2 font-semibold">User</th>
              <th className="text-right py-2 px-2 font-semibold">총 LTV</th>
              <th className="text-right py-2 px-2 font-semibold">이 제품 매출</th>
              <th className="text-right py-2 px-2 font-semibold">주문 수</th>
              <th className="text-right py-2 px-2 font-semibold">첫 구매</th>
            </tr>
          </thead>
          <tbody>
            {topBuyers.map((b) => (
              <tr key={b.userId} className="border-b border-line/60">
                <td className="py-2 px-2 text-ink font-mono text-[10.5px]">
                  {b.userId.slice(0, 8)}…
                </td>
                <td className="py-2 px-2 text-right">
                  ₩{b.totalRevenue.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right">
                  ₩{b.productRevenue.toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right">{b.orderCount}</td>
                <td className="py-2 px-2 text-right text-mute">
                  {b.firstOrderAt
                    ? new Date(b.firstOrderAt).toLocaleDateString('ko-KR')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {buyerCount === 0 && (
          <p className="text-xs text-mute py-6 text-center">
            아직 구매 기록이 없어요.
          </p>
        )}
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded border border-line p-3">
      <div className="text-[10px] uppercase tracking-wider text-mute font-semibold">
        {label}
      </div>
      <div className="text-xl text-ink mt-1">{value}</div>
      {hint && <div className="text-[10px] text-mute mt-1">{hint}</div>}
    </div>
  )
}
