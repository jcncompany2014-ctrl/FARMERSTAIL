import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/products/stock'

export const dynamic = 'force-dynamic'

type RecentOrder = {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  order_status: string
  created_at: string
  recipient_name: string
}

type OrderItemLite = {
  product_id: string | null
  product_name: string | null
  product_image_url: string | null
  quantity: number
  line_total: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}.${day} ${hh}:${mm}`
}

const STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  preparing: '준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '취소',
}

function statusBadge(paymentStatus: string, orderStatus: string) {
  if (paymentStatus !== 'paid') {
    return { label: '결제 전', color: 'bg-rule text-text' }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', color: 'bg-terracotta text-white' }
    case 'shipping':
      return { label: '배송 중', color: 'bg-moss text-white' }
    case 'delivered':
      return { label: '완료', color: 'bg-[#8BA05A] text-white' }
    case 'cancelled':
      return { label: '취소', color: 'bg-sale text-white' }
    default:
      return { label: STATUS_LABEL[orderStatus] ?? orderStatus, color: 'bg-rule text-text' }
  }
}

export default async function AdminHome() {
  const supabase = await createClient()

  // 오늘 0시 ISO
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  // 30일 전
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 지난 7일/지난 30일 경계 — WoW / MoM 비교용
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString()

  // 병렬로 쿼리 (is_admin 정책 덕분에 전체 조회 가능)
  const [
    paidOrdersRes,
    todayOrdersRes,
    pendingShipRes,
    usersRes,
    recentOrdersRes,
    thirtyDayOrdersRes,
    activeSubscriptionsRes,
    lowStockRes,
    lastWeekOrdersRes,
    prevWeekOrdersRes,
    failedOrdersRes,
  ] = await Promise.all([
    // 누적 매출 (paid만)
    supabase
      .from('orders')
      .select('total_amount', { count: 'exact' })
      .eq('payment_status', 'paid'),

    // 오늘 주문 수
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // 배송 대기 (preparing 상태)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('order_status', 'preparing'),

    // 전체 회원 수
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),

    // 최근 주문 10건
    supabase
      .from('orders')
      .select('id, order_number, total_amount, payment_status, order_status, created_at, recipient_name')
      .order('created_at', { ascending: false })
      .limit(10),

    // 최근 30일 매출 (일별 차트 + Top 상품 원자료)
    supabase
      .from('orders')
      .select('id, total_amount, created_at, order_items(product_id, product_name, product_image_url, quantity, line_total)')
      .eq('payment_status', 'paid')
      .gte('created_at', thirtyDaysAgo),

    // 활성 구독 — MRR 추정(total_amount × 4주/interval 환산)
    supabase
      .from('subscriptions')
      .select('id, total_amount, interval_weeks', { count: 'exact' })
      .eq('status', 'active'),

    // 재고 경고 — 개별 상품 stock <= LOW_THRESHOLD 인 수. is_active 는
    // 상품 테이블에 존재한다 전제, 없으면 그냥 전체 집계.
    supabase
      .from('products')
      .select('id, name, slug, stock', { count: 'exact' })
      .lte('stock', STOCK_LOW_THRESHOLD)
      .order('stock', { ascending: true })
      .limit(5),

    // 최근 7일 주문 매출
    supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', sevenDaysAgo),

    // 전전주 (14~7일 전) 주문 매출 — WoW 비교
    supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', fourteenDaysAgo)
      .lt('created_at', sevenDaysAgo),

    // 결제 실패 카운트 (최근 30일)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'failed')
      .gte('created_at', thirtyDaysAgo),
  ])

  const totalRevenue =
    paidOrdersRes.data?.reduce(
      (sum, o: { total_amount: number | null }) => sum + (o.total_amount ?? 0),
      0
    ) ?? 0
  const totalPaidCount = paidOrdersRes.count ?? 0
  const todayOrderCount = todayOrdersRes.count ?? 0
  const pendingShipCount = pendingShipRes.count ?? 0
  const userCount = usersRes.count ?? 0
  const recentOrders = (recentOrdersRes.data ?? []) as RecentOrder[]

  // 평균 주문가 (AOV) — 결제 완료 기준. 분모 0 방어.
  const aov = totalPaidCount > 0 ? Math.round(totalRevenue / totalPaidCount) : 0

  // 월 예상 매출 (MRR) — 각 활성 구독의 주기를 4주 기준으로 환산해 월 매출
  // 근사치. interval_weeks 가 2 면 월 2회 = total_amount × 2, 4 면 월 1회,
  // 1 이면 월 4회.
  const activeSubs =
    (activeSubscriptionsRes.data ?? []) as Array<{
      total_amount: number | null
      interval_weeks: number | null
    }>
  const activeSubCount = activeSubscriptionsRes.count ?? activeSubs.length
  const estimatedMrr = activeSubs.reduce((sum, s) => {
    const amount = s.total_amount ?? 0
    const weeks = s.interval_weeks && s.interval_weeks > 0 ? s.interval_weeks : 4
    // 4주 / 주기 = 월간 배송 횟수
    return sum + amount * (4 / weeks)
  }, 0)

  const lowStockCount = lowStockRes.count ?? 0
  const lowStockItems =
    (lowStockRes.data ?? []) as Array<{
      id: string
      name: string
      slug: string
      stock: number
    }>

  const failedOrderCount = failedOrdersRes.count ?? 0

  // WoW 매출 변화
  const lastWeekRevenue =
    (lastWeekOrdersRes.data ?? []).reduce(
      (s, o: { total_amount: number | null }) => s + (o.total_amount ?? 0),
      0,
    ) ?? 0
  const prevWeekRevenue =
    (prevWeekOrdersRes.data ?? []).reduce(
      (s, o: { total_amount: number | null }) => s + (o.total_amount ?? 0),
      0,
    ) ?? 0
  const wowDelta =
    prevWeekRevenue > 0
      ? ((lastWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
      : lastWeekRevenue > 0
        ? 100
        : 0

  // 30일 매출 집계 (간단한 sparkline용) + Top 상품 집계
  type ThirtyDayOrder = {
    created_at: string
    total_amount: number
    order_items: OrderItemLite[] | null
  }
  const thirtyDayOrders =
    (thirtyDayOrdersRes.data ?? []) as unknown as ThirtyDayOrder[]

  const dailyMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    dailyMap.set(key, 0)
  }
  thirtyDayOrders.forEach((o) => {
    const d = new Date(o.created_at)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + o.total_amount)
  })
  const dailyData = Array.from(dailyMap.entries())
  const maxDaily = Math.max(...dailyData.map(([, v]) => v), 1)
  const last30DayRevenue = dailyData.reduce((s, [, v]) => s + v, 0)

  // Top 상품 (30일 매출 기준). product_id 가 없는 아이템(삭제된 상품) 은 스킵.
  const productStats = new Map<
    string,
    { name: string; image: string | null; qty: number; revenue: number }
  >()
  for (const order of thirtyDayOrders) {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue
      const prev = productStats.get(item.product_id)
      if (prev) {
        prev.qty += item.quantity
        prev.revenue += item.line_total
      } else {
        productStats.set(item.product_id, {
          name: item.product_name ?? '(이름 없음)',
          image: item.product_image_url,
          qty: item.quantity,
          revenue: item.line_total,
        })
      }
    }
  }
  const topProducts = Array.from(productStats.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">
            DASHBOARD
          </h1>
          <p className="text-sm text-muted mt-1">
            {now.getFullYear()}년 {now.getMonth() + 1}월 {now.getDate()}일 기준
          </p>
        </div>
      </div>

      {/* 지표 카드 4개 — 1행 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          sub={`완료 주문 ${totalPaidCount}건`}
          tone="red"
        />
        <MetricCard
          label="오늘 주문"
          value={`${todayOrderCount}건`}
          sub="payment_status 무관"
          tone="dark"
        />
        <MetricCard
          label="배송 대기"
          value={`${pendingShipCount}건`}
          sub="준비 중 상태"
          tone="green"
        />
        <MetricCard
          label="총 회원"
          value={`${userCount}명`}
          sub="profiles 기준"
          tone="dark"
        />
      </div>

      {/* 지표 카드 4개 — 2행: Ops / Retention 시그널 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="AOV (평균 주문가)"
          value={`${aov.toLocaleString()}원`}
          sub={`누적 ${totalPaidCount}건 기준`}
          tone="dark"
        />
        <MetricCard
          label="활성 구독"
          value={`${activeSubCount}건`}
          sub={`월 예상 ${Math.round(estimatedMrr).toLocaleString()}원`}
          tone="green"
        />
        <MetricCard
          label="재고 경고"
          value={`${lowStockCount}개`}
          sub={`stock ≤ ${STOCK_LOW_THRESHOLD} 기준`}
          tone={lowStockCount > 0 ? 'red' : 'dark'}
        />
        <MetricCard
          label="결제 실패 (30일)"
          value={`${failedOrderCount}건`}
          sub={
            wowDelta === 0
              ? 'WoW 변화 없음'
              : `WoW 매출 ${wowDelta > 0 ? '+' : ''}${wowDelta.toFixed(1)}%`
          }
          tone={failedOrderCount > 0 ? 'red' : 'dark'}
        />
      </div>

      {/* 30일 매출 sparkline */}
      <div className="p-6 rounded-2xl bg-white border border-rule mb-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-ink">최근 30일 매출</h2>
            <p className="text-[11px] text-muted mt-0.5">
              결제 완료된 주문만 집계
            </p>
          </div>
          <p className="font-['Archivo_Black'] text-2xl text-terracotta">
            {last30DayRevenue.toLocaleString()}원
          </p>
        </div>
        <div className="flex items-end gap-1 h-24">
          {dailyData.map(([date, value]) => {
            const height = (value / maxDaily) * 100
            return (
              <div
                key={date}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full bg-terracotta rounded-sm transition-all hover:bg-[#8A3822] min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                {value > 0 && (
                  <span className="absolute -top-5 opacity-0 group-hover:opacity-100 text-[9px] text-ink whitespace-nowrap bg-white px-1 rounded border border-rule transition">
                    {value.toLocaleString()}원
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-muted">
          <span>{dailyData[0]?.[0]}</span>
          <span>{dailyData[dailyData.length - 1]?.[0]}</span>
        </div>
      </div>

      {/* Top 상품 + 재고 경고 — 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-6 rounded-2xl bg-white border border-rule">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink">Top 상품 (30일)</h2>
              <p className="text-[11px] text-muted mt-0.5">
                결제 완료 주문의 라인 매출 합계
              </p>
            </div>
            <Link
              href="/admin/products"
              className="text-xs text-terracotta hover:underline"
            >
              상품 관리 →
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">
              30일 내 판매가 없어요
            </p>
          ) : (
            <ol className="space-y-2">
              {topProducts.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2 border-b border-bg last:border-b-0"
                >
                  <span className="font-['Archivo_Black'] text-sm text-muted w-5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{p.name}</p>
                    <p className="text-[10px] text-muted">
                      {p.qty.toLocaleString()}개 판매
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-terracotta whitespace-nowrap">
                    {p.revenue.toLocaleString()}원
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-white border border-rule">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink">재고 경고</h2>
              <p className="text-[11px] text-muted mt-0.5">
                stock ≤ {STOCK_LOW_THRESHOLD} · 낮은 순
              </p>
            </div>
            {lowStockCount > 5 && (
              <Link
                href="/admin/products"
                className="text-xs text-terracotta hover:underline"
              >
                {lowStockCount}건 전체 →
              </Link>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">
              모든 상품 재고가 안전 범위예요
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-bg last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/products/${item.id}`}
                      className="text-sm text-ink hover:text-terracotta truncate block"
                    >
                      {item.name}
                    </Link>
                    <p className="text-[10px] text-muted font-mono">
                      /products/{item.slug}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      item.stock <= 0
                        ? 'bg-sale text-white'
                        : 'bg-gold/15 text-gold'
                    }`}
                  >
                    {item.stock <= 0 ? '품절' : `${item.stock}개`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 최근 주문 */}
      <div className="p-6 rounded-2xl bg-white border border-rule">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-ink">최근 주문</h2>
          <Link
            href="/admin/orders"
            className="text-xs text-terracotta hover:underline"
          >
            전체 보기 →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            아직 주문이 없어요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-rule">
                  <th className="text-left py-2 font-medium">주문번호</th>
                  <th className="text-left py-2 font-medium">주문자</th>
                  <th className="text-right py-2 font-medium">금액</th>
                  <th className="text-center py-2 font-medium">상태</th>
                  <th className="text-right py-2 font-medium">시각</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const badge = statusBadge(o.payment_status, o.order_status)
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-bg hover:bg-bg transition"
                    >
                      <td className="py-3 font-mono text-[11px] text-ink">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="hover:text-terracotta"
                        >
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-3 text-ink">{o.recipient_name}</td>
                      <td className="py-3 text-right font-semibold text-ink">
                        {o.total_amount.toLocaleString()}원
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
                        {formatDate(o.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'red' | 'dark' | 'green'
}) {
  const toneClass =
    tone === 'red'
      ? 'text-terracotta'
      : tone === 'green'
      ? 'text-moss'
      : 'text-ink'

  return (
    <div className="p-5 rounded-2xl bg-white border border-rule">
      <p className="text-[11px] text-muted font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className={`mt-2 font-['Archivo_Black'] text-2xl ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted">{sub}</p>
    </div>
  )
}