import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/products/stock'
import RevenueChart, { type RevenuePoint } from '@/components/admin/RevenueChart'
import CategoryRevenueDonut, {
  type CategoryRevenuePoint,
} from '@/components/admin/CategoryRevenueDonut'
import FoodInfoCompletion, {
  type ProductInfoLite,
} from '@/components/admin/FoodInfoCompletion'
import CohortRetentionTable, {
  type CohortRow,
} from '@/components/admin/CohortRetentionTable'

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
    newSubsRes,
    churnedSubsRes,
    todayRevenueRes,
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

    // 30일 신규 구독 — created_at 기준
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    // 30일 해지 구독 — status='cancelled' AND updated_at 30일 내
    // (status 변경 시점이 곧 해지 시점이라는 가정 — 트리거가 다른 컬럼을 건드릴
    // 가능성이 있으면 cancelled_at 컬럼을 추가하는 게 정확)
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('updated_at', thirtyDaysAgo),

    // 오늘 매출 — payment_status='paid' AND created_at >= 오늘 0시
    supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', todayStart),
  ])

  // 식품정보고시 14항목 채움률 — 별도 쿼리. 100개 이하 가정.
  const { data: foodInfoProducts } = await supabase
    .from('products')
    .select(
      `id, name, origin, manufacturer, manufacturer_address,
       manufacture_date_policy, shelf_life_days, net_weight_g, ingredients,
       nutrition_facts, allergens, storage_method, feeding_guide,
       pet_food_class, certifications, country_of_packaging`,
    )
    .eq('is_active', true)
    .limit(200)
  const productInfo = (foodInfoProducts ?? []) as ProductInfoLite[]

  // 코호트 리텐션 — RPC. RPC 함수가 prod 에 없으면 (마이그레이션 미적용)
  // 빈 배열로 fallback. admin 가드는 RPC 자체가 함.
  let cohortRows: CohortRow[] = []
  try {
    const { data: cohortData } = await supabase.rpc(
      'cohort_retention_weekly',
      { p_max_cohorts: 12 },
    )
    cohortRows = (cohortData ?? []) as CohortRow[]
  } catch {
    /* 마이그레이션 미적용 / 권한 미확보 — UI 가 빈 상태 처리 */
  }

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

  // 구독 30일 net 변화 (신규 - 해지). 음수면 churn 우세.
  const newSubsCount = newSubsRes.count ?? 0
  const churnedSubsCount = churnedSubsRes.count ?? 0
  const netSubsDelta = newSubsCount - churnedSubsCount
  // Churn rate = 해지 / (활성 + 해지) — 단순 근사치, 코호트 분석은 별도.
  const churnDenom = activeSubCount + churnedSubsCount
  const churnRatePct =
    churnDenom > 0 ? (churnedSubsCount / churnDenom) * 100 : 0

  // 오늘 매출
  const todayRevenue =
    (todayRevenueRes.data ?? []).reduce(
      (s, o: { total_amount: number | null }) => s + (o.total_amount ?? 0),
      0,
    ) ?? 0

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

  // 30일 일별 매출 — RevenueChart 가 (YYYY-MM-DD, revenue) 형태를 요구.
  const dailyMap = new Map<string, number>()
  const fmtDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    dailyMap.set(fmtDateKey(d), 0)
  }
  thirtyDayOrders.forEach((o) => {
    const key = fmtDateKey(new Date(o.created_at))
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + o.total_amount)
    }
  })
  const dailyChartData: RevenuePoint[] = Array.from(dailyMap.entries()).map(
    ([date, revenue]) => ({ date, revenue }),
  )
  // 30일 합계는 RevenueChart 가 자체 계산해서 보여주므로 별도 변수 없음.

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

  // 카테고리별 매출 — productInfo 의 id → category 매핑 활용 + 30일 line_total
  // 합산. productInfo 는 이미 active 상품만이라 cancelled 카테고리도 자연 배제.
  const productCategoryMap = new Map<string, string | null>()
  for (const p of productInfo) {
    productCategoryMap.set(p.id, null) // category 컬럼은 productInfo 에서 안 가져옴
  }
  // 별도 쿼리 — productInfo 가 category 빠뜨려서 추가 round-trip. 비용 작음
  // (단순 select).
  const { data: categoryRows } = await supabase
    .from('products')
    .select('id, category')
    .eq('is_active', true)
  const catMap = new Map<string, string | null>(
    (categoryRows ?? []).map((p) => [p.id as string, (p.category as string | null) ?? null]),
  )
  const categoryRevenueAgg = new Map<string, number>()
  for (const order of thirtyDayOrders) {
    for (const item of order.order_items ?? []) {
      if (!item.product_id) continue
      const cat = catMap.get(item.product_id) ?? '미분류'
      const key = cat || '미분류'
      categoryRevenueAgg.set(
        key,
        (categoryRevenueAgg.get(key) ?? 0) + item.line_total,
      )
    }
  }
  const categoryRevenue: CategoryRevenuePoint[] = Array.from(
    categoryRevenueAgg.entries(),
  ).map(([category, revenue]) => ({ category, revenue }))

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
          label="오늘 매출"
          value={`${todayRevenue.toLocaleString()}원`}
          sub={`주문 ${todayOrderCount}건`}
          tone="red"
        />
        <MetricCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          sub={`완료 ${totalPaidCount}건`}
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

      {/* 지표 카드 4개 — 2행: Ops 시그널 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
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

      {/* 지표 카드 3개 — 3행: 구독 retention. D2C 펫푸드는 정기배송이 LTV 의
          핵심 동력이라 별개 행으로 강조. */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="구독 신규 (30일)"
          value={`${newSubsCount}건`}
          sub={
            netSubsDelta > 0
              ? `순증가 +${netSubsDelta}건`
              : netSubsDelta < 0
                ? `순감소 ${netSubsDelta}건`
                : '순변화 없음'
          }
          tone={netSubsDelta >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="구독 해지 (30일)"
          value={`${churnedSubsCount}건`}
          sub={
            churnRatePct === 0
              ? '해지 0%'
              : `Churn ${churnRatePct.toFixed(1)}%`
          }
          tone={churnRatePct > 5 ? 'red' : 'dark'}
        />
        <MetricCard
          label="이번 주 매출"
          value={`${lastWeekRevenue.toLocaleString()}원`}
          sub={
            wowDelta === 0
              ? 'WoW 변화 없음'
              : `vs 전주 ${wowDelta > 0 ? '+' : ''}${wowDelta.toFixed(1)}%`
          }
          tone={wowDelta >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* 30일 매출 — SVG line chart (RevenueChart) */}
      <div className="mb-4">
        <RevenueChart data={dailyChartData} title="최근 30일 매출" />
      </div>

      {/* 카테고리별 매출 도넛 + 식품정보고시 채움률 — 출시 직전 운영자 핵심
          모니터링 항목. 채움률 < 100% 면 시정명령 위험. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CategoryRevenueDonut data={categoryRevenue} />
        <FoodInfoCompletion products={productInfo} />
      </div>

      {/* 코호트 리텐션 — 가입 주별 재구매율. W4 가 정기배송 conversion 신호. */}
      <div className="mb-6">
        <CohortRetentionTable rows={cohortRows} />
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