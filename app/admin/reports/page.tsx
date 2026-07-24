import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  TrendingUp,
  ShoppingBag,
  Repeat,
  Coins,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { isAdmin } from '@/lib/auth/admin'
import { HelpTip, AdminTabs } from '@/components/admin/ui'
import { REVENUE_TABS } from '@/components/admin/tabGroups'
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
  // 기본 연·월·월경계 모두 **KST** 기준. 서버 UTC 로 now.getMonth() / new Date(year,
  // month-1, 1) 를 쓰면 KST 1일 00~08:59(=UTC 전월)에 ① 기본 조회월이 전월로 잡히고
  // ② 그 시간대 매출이 전월 범위로 새어 월 매출이 어긋난다. +09:00 으로 KST 자정 명시.
  const kstToday = todayKstIsoDate() // 'YYYY-MM-DD' (KST)
  const year = sp.year ? parseInt(sp.year, 10) : parseInt(kstToday.slice(0, 4), 10)
  const month = sp.month ? parseInt(sp.month, 10) : parseInt(kstToday.slice(5, 7), 10)

  const mm = String(month).padStart(2, '0')
  const monthStart = new Date(`${year}-${mm}-01T00:00:00+09:00`).toISOString()
  const nextY = month === 12 ? year + 1 : year
  const nextM = month === 12 ? 1 : month + 1
  const monthEnd = new Date(
    `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+09:00`,
  ).toISOString()

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

      {/* 대개편 v2 T3 — 매출·결제 그룹 탭 (뒤로가기 링크 대체·헤더 zinc 통일) */}
      <div className="no-print">
        <AdminTabs tabs={REVENUE_TABS} active="/admin/reports" />
      </div>
      <div className="flex items-end justify-between mb-6 no-print">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            매출 리포트
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            장사가 얼마나 됐는지 달별로 보는 곳이에요 — 매출·환불·정기배송 수·
            많이 나간 레시피를 한눈에 봐요. 오른쪽 인쇄 버튼으로 저장할 수 있어요.
          </p>
        </div>
        <PrintButtonClient />
      </div>

      {/* 월 navigate */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text" strokeWidth={2} />
          <span
            className="font-sans"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#18181b',
              letterSpacing: '-0.02em',
            }}
          >
            {year}년 {month}월 리포트
          </span>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Link
            href={prevHref}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-[11px] font-bold hover:border-text transition"
          >
            ← 이전 달
          </Link>
          <Link
            href={nextHref}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-[11px] font-bold hover:border-text transition"
          >
            다음 달 →
          </Link>
        </div>
      </div>

      {/* Hero 매출 카드 — 클린 zinc 다크 (2026-07 잔재청소: 웜브라운+골드 serif 제거) */}
      <section className="rounded-lg px-6 py-5 text-white mb-5 bg-zinc-900 print:break-inside-avoid print:bg-white print:text-zinc-900 print:border print:border-zinc-300">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-[0.16em] uppercase text-zinc-400 print:text-zinc-500">
          순매출
          <HelpTip text="이번 달 결제 완료 합계(매출)에서 환불을 뺀, 실제로 남는 매출이에요. 세무 신고·운영 리뷰의 기준 숫자." />
        </span>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-bold leading-none tabular-nums tracking-tight text-white text-[40px] print:text-zinc-900">
            {netRevenue.toLocaleString()}
          </span>
          <span className="text-[16px] text-white/85 font-bold print:text-zinc-500">
            원
          </span>
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
      <section className="bg-white rounded-xl border border-zinc-200 px-5 py-4 mb-6 print:break-inside-avoid">
        <span className="kicker kicker-muted">
          차감 항목
          <HelpTip
            text={
              totalPointsUsed > 0
                ? '할인은 결제 전에 이미 빠진 금액(참고용), 환불만 순매출에서 실제로 차감돼요. 포인트는 폐지된 제도라 과거 달에만 값이 남아있어요.'
                : '할인은 결제 전에 이미 빠진 금액(참고용), 환불만 순매출에서 실제로 차감돼요.'
            }
          />
        </span>
        <div
          className={`mt-2 grid gap-2 text-[12px] ${
            totalPointsUsed > 0 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <div>
            <span className="text-muted">할인</span>
            <div className="font-bold tabular-nums text-text">
              -{totalDiscount.toLocaleString()}원
            </div>
          </div>
          {/* 포인트는 폐지된 제도(2026-07-16) — 과거 이력이 있을 때만 표시. */}
          {totalPointsUsed > 0 && (
            <div>
              <span className="text-muted">포인트 사용 (폐지)</span>
              <div className="font-bold tabular-nums text-text">
                -{totalPointsUsed.toLocaleString()}원
              </div>
            </div>
          )}
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
          <span className="kicker mb-2 block">많이 팔린 상품</span>
          <ol className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            {topProducts.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < topProducts.length - 1 ? 'border-b border-zinc-200' : ''
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
          <span className="kicker mb-2 block">결제수단</span>
          <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3">
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
        * 결제 완료 주문과 환불 완료 건을 기준으로 해요. 입금 대기(가상계좌)는
        입금된 날짜로 자동 합산돼요.
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
    <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3.5">
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
        className="mt-1 font-sans tabular-nums"
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

