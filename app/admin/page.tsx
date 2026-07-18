import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/products/stock'
import RevenueChart, { type RevenuePoint } from '@/components/admin/RevenueChart'
import FoodInfoCompletion, {
  type ProductInfoLite,
} from '@/components/admin/FoodInfoCompletion'
import CohortRetentionTable, {
  type CohortRow,
} from '@/components/admin/CohortRetentionTable'
import CohortLtvTable, {
  type LtvRow,
} from '@/components/admin/CohortLtvTable'
import ActionsPanel from '@/components/admin/ActionsPanel'
import { AdminHeader, StatCard, SectionTitle } from '@/components/admin/ui'
import {
  formatKstShortDateTime as formatDate,
  todayKstIsoDate,
} from '@/lib/datetime-kst'

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

  // 오늘 0시 (KST) — Vercel UTC 환경에서도 KST 자정 경계로 정확히 집계.
  // 이전엔 서버 로컬(UTC) 자정이라 "오늘 매출/주문" 이 KST 09:00 부터 집계되며
  // 00:00–08:59 KST 주문이 전날로 빠졌다.
  const now = new Date()
  const todayKst = todayKstIsoDate()
  const todayStart = new Date(`${todayKst}T00:00:00+09:00`).toISOString()
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

    // 활성 구독 — MRR 추정. ★카드 등록(billing_key) 된 구독만: 카드 미등록
    // 구독은 청구가 한 번도 안 일어나는 '신청만' 상태라 매출 추정에 넣으면
    // MRR 이 과대계상된다(2026-07-19 검수).
    supabase
      .from('subscriptions')
      .select('id, total_amount', { count: 'exact' })
      .eq('status', 'active')
      .not('billing_key', 'is', null),

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

  // ── 처리 대기 큐 (admin hot path) — 솔로 창업자가 매일 한 번 보고
  // 처리해야 하는 작업 카운트. 모두 head:true 로 count 만 가져옴.
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgoIso = sevenDaysAgo
  const [
    unshippedRes,
    shippingStuckRes,
    cardRenewalRes,
    recentFailedChargeRes,
    refundsPendingRes,
    stockOutRes,
    cronFailRes,
    noCardSubsRes,
  ] = await Promise.all([
    // preparing + paid + 24h+ → 발송 stale
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('order_status', 'preparing')
      .lt('created_at', oneDayAgo),
    // shipping + 7d+ → 배송 stuck (택배사 이슈 가능)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'shipping')
      .lt('shipped_at', sevenDaysAgoIso),
    // 정기배송 카드 재등록 대기
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('requires_billing_key_renewal', true),
    // 24h 내 결제 실패한 정기배송
    supabase
      .from('subscription_charges')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('attempted_at', oneDayAgo),
    // 환불 pending (refunds 테이블에 행이 있는 케이스)
    supabase
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // 재고 0 상품 (is_active=true)
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .lte('stock', 0),
    // 24h 내 실패한 cron 카운트
    supabase
      .from('cron_health')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('executed_at', oneDayAgo),
    // 카드 미등록 활성 구독 — 신청만 하고 결제 수단을 안 붙인 상태.
    // 첫 청구가 영영 안 일어나므로 며칠 지나면 리마인드 대상.
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('billing_key', null),
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
  // audit #79: cohort_retention_weekly RPC 가 generated types 에 없음.
  let cohortRows: CohortRow[] = []
  try {
    const { data: cohortData } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown }>
      }
    ).rpc('cohort_retention_weekly', { p_max_cohorts: 12 })
    cohortRows = ((cohortData as unknown) ?? []) as CohortRow[]
  } catch {
    /* 마이그레이션 미적용 / 권한 미확보 — UI 가 빈 상태 처리 */
  }

  // 코호트 LTV — D7/D30/D90 평균. cohort_ltv_weekly RPC.
  let ltvRows: LtvRow[] = []
  try {
    const { data: ltvData } = await supabase.rpc('cohort_ltv_weekly', {
      weeks_back: 12,
    })
    ltvRows = (ltvData ?? []) as LtvRow[]
  } catch {
    /* RPC 미적용 또는 권한 미확보 */
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

  // 월 예상 매출 (MRR) — 배송 주기는 **2주 하나로 고정**이라(2026-07-13) 월 2회.
  // 2026-07-16: 예전엔 interval_weeks 로 나눠 환산하고 값이 없으면 4주로 폴백했는데,
  // 주기가 가변이라는 전제 자체가 옛 낱개 커머스 잔재다(박스가 14일치라 다른 주기는
  // 성립하지 않는다). 폴백 4주는 매출을 절반으로 과소계상하기까지 했다.
  const activeSubs =
    (activeSubscriptionsRes.data ?? []) as Array<{
      total_amount: number | null
    }>
  const activeSubCount = activeSubscriptionsRes.count ?? activeSubs.length
  const estimatedMrr = activeSubs.reduce(
    (sum, s) => sum + (s.total_amount ?? 0) * 2,
    0,
  )

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
  // ★날짜 키는 KST 기준(+9h shift 후 UTC getter) — 서버 로컬(UTC) getter 를
  // 쓰면 KST 00:00~08:59 주문이 전날 막대로 빠진다(todayStart 와 같은 함정).
  const dailyMap = new Map<string, number>()
  const fmtDateKey = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(
      kst.getUTCDate(),
    ).padStart(2, '0')}`
  }
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

  // (카테고리별 매출 도넛은 2026-07-19 검수에서 제거 — 구독 전용 전환 후 활성
  //  상품이 화식 4종뿐이라 도넛이 항상 '화식 ~100%' 원 하나였다. 정보가치 0.)

  return (
    <div>
      <AdminHeader
        title="대시보드"
        sub={`${todayKst.slice(0, 4)}년 ${Number(todayKst.slice(5, 7))}월 ${Number(todayKst.slice(8, 10))}일 기준`}
      />

      {/* 처리 대기 큐 — admin hot path. 0건이면 회색, 있으면 sale 강조. */}
      <div className="mb-6">
        <ActionsPanel
          unshippedCount={unshippedRes.count ?? 0}
          shippingStuckCount={shippingStuckRes.count ?? 0}
          cardRenewalCount={cardRenewalRes.count ?? 0}
          recentFailedCount={recentFailedChargeRes.count ?? 0}
          refundsPendingCount={refundsPendingRes.count ?? 0}
          stockOutCount={stockOutRes.count ?? 0}
          cronFailureCount={cronFailRes.count ?? 0}
        />
      </div>

      {/* 오늘·전체 한눈에 — 쉬운 라벨 + 도움말(?) */}
      <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2 mt-2">
        한눈에 보기
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="오늘 매출"
          value={`${todayRevenue.toLocaleString()}원`}
          sub={`오늘 결제된 주문 ${todayOrderCount}건`}
        />
        <StatCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          sub={`지금까지 결제 완료 ${totalPaidCount}건`}
          help="가게를 연 뒤 지금까지 결제가 끝난 모든 주문 금액을 더한 값이에요."
        />
        <StatCard
          label="발송할 주문"
          value={`${pendingShipCount}건`}
          sub="결제됐고 아직 안 보낸 주문"
          tone={pendingShipCount > 0 ? 'amber' : 'neutral'}
          help="여기 숫자가 있으면 오늘 택배 발송 준비를 하세요. 0이면 밀린 게 없어요."
        />
        <StatCard
          label="가입 회원"
          value={`${userCount}명`}
          sub="가입한 전체 고객 수"
        />
      </div>

      {/* 구독 현황 — 정기배송이 이 사업의 핵심 매출원 */}
      <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2 mt-5">
        구독 현황
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="구독 중인 고객"
          value={`${activeSubCount}명`}
          sub={`2주마다 자동결제 · 월 예상 ${Math.round(estimatedMrr).toLocaleString()}원${(noCardSubsRes.count ?? 0) > 0 ? ` · 카드 미등록 ${noCardSubsRes.count}명` : ''}`}
          tone="green"
          help="카드까지 등록해 실제로 결제되는 구독 수예요. '카드 미등록'은 신청만 하고 결제 수단을 안 붙인 고객 — 며칠 지나면 리마인드해 주세요."
        />
        <StatCard
          label="새 구독 (30일)"
          value={`${newSubsCount}명`}
          sub={
            netSubsDelta > 0
              ? `실제 +${netSubsDelta}명 늘었어요`
              : netSubsDelta < 0
                ? `실제 ${netSubsDelta}명 줄었어요`
                : '늘지도 줄지도 않음'
          }
          tone={netSubsDelta >= 0 ? 'green' : 'red'}
          help="최근 30일간 새로 구독을 시작한 고객 수예요. 아래 문구는 '새 구독에서 해지를 뺀' 실제 변화예요."
        />
        <StatCard
          label="구독 해지 (30일)"
          value={`${churnedSubsCount}명`}
          sub={churnRatePct === 0 ? '해지율 0%' : `해지율 ${churnRatePct.toFixed(1)}%`}
          tone={churnRatePct > 5 ? 'red' : 'neutral'}
          help="최근 30일간 구독을 끊은 고객 수예요. 해지율이 5%를 넘으면 왜 떠나는지 살펴보는 게 좋아요."
        />
        <StatCard
          label="이번 주 매출"
          value={`${lastWeekRevenue.toLocaleString()}원`}
          sub={
            wowDelta === 0
              ? '지난주와 같음'
              : `지난주보다 ${wowDelta > 0 ? '+' : ''}${wowDelta.toFixed(1)}%`
          }
          tone={wowDelta >= 0 ? 'green' : 'red'}
          help="최근 7일간 결제 합계를 그 전 7일과 비교한 거예요."
        />
      </div>

      {/* 운영 체크 — 매일 확인하면 좋은 숫자 */}
      <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2 mt-5">
        운영 체크
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="평균 주문 금액"
          value={`${aov.toLocaleString()}원`}
          sub="주문 1건당 평균"
          help="결제 완료된 주문들의 평균 금액이에요. (누적 매출 ÷ 주문 수)"
        />
        <StatCard
          label="재고 부족 상품"
          value={`${lowStockCount}개`}
          sub={`재고 ${STOCK_LOW_THRESHOLD}개 이하`}
          tone={lowStockCount > 0 ? 'red' : 'neutral'}
          help="재고가 얼마 안 남은 상품이에요. 품절되기 전에 미리 채워두세요."
        />
        <StatCard
          label="결제 실패 (30일)"
          value={`${failedOrderCount}건`}
          sub="카드 문제 등으로 실패"
          tone={failedOrderCount > 0 ? 'red' : 'neutral'}
          help="카드 한도·유효기간 만료 등으로 결제가 안 된 건이에요. 많으면 고객에게 안내가 필요해요."
        />
      </div>

      {/* 30일 매출 — SVG line chart (RevenueChart) */}
      <div className="mb-4">
        <RevenueChart data={dailyChartData} title="최근 30일 매출" />
      </div>

      {/* 식품정보고시 채움률 — 채움률 < 100% 면 시정명령 위험. */}
      <div className="mb-6">
        <FoodInfoCompletion products={productInfo} />
      </div>

      {/* 코호트 리텐션 — 가입 주별 재구매율. W4 가 정기배송 conversion 신호. */}
      <div className="mb-6">
        <p className="text-[12px] text-zinc-500 mb-2 leading-snug">
          아래 표는{' '}
          <b className="text-zinc-700">가입한 시기별로 고객이 계속 사는지</b>를
          보여줘요. 오른쪽 칸 숫자가 높을수록 오래 남는 단골이에요. (어려우면 넘어가도 괜찮아요.)
        </p>
        <CohortRetentionTable rows={cohortRows} />
      </div>

      <div className="mb-6">
        <p className="text-[12px] text-zinc-500 mb-2 leading-snug">
          아래 표는{' '}
          <b className="text-zinc-700">한 고객이 가입 후 평균 얼마를 쓰는지</b>
          (생애가치)를 보여줘요.
        </p>
        <CohortLtvTable rows={ltvRows} />
      </div>

      {/* Top 상품 + 재고 경고 — 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-lg bg-white border border-zinc-200">
          <SectionTitle
            title="많이 나간 상품 (최근 30일)"
            desc="최근 30일간 매출이 큰 상품 순서예요."
            action={
              <Link
                href="/admin/products"
                className="text-xs text-terracotta hover:underline font-semibold whitespace-nowrap"
              >
                상품 관리 →
              </Link>
            }
          />
          {topProducts.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">
              30일 내 판매가 없어요
            </p>
          ) : (
            <ol className="space-y-2">
              {topProducts.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2 border-b border-zinc-100 last:border-b-0"
                >
                  <span className="font-bold text-sm text-zinc-400 w-5">
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

        <div className="p-5 rounded-lg bg-white border border-zinc-200">
          <SectionTitle
            title="재고 부족 상품"
            desc={`재고가 ${STOCK_LOW_THRESHOLD}개 이하로 남은 상품이에요. 품절 전에 채워주세요.`}
            action={
              lowStockCount > 5 ? (
                <Link
                  href="/admin/products"
                  className="text-xs text-terracotta hover:underline font-semibold whitespace-nowrap"
                >
                  {lowStockCount}건 전체 →
                </Link>
              ) : undefined
            }
          />
          {lowStockItems.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">
              모든 상품 재고가 안전 범위예요
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-b-0"
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
      <div className="p-5 rounded-lg bg-white border border-zinc-200">
        <SectionTitle
          title="최근 들어온 주문"
          desc="가장 최근 주문 10건이에요. 주문번호를 누르면 자세히 볼 수 있어요."
          action={
            <Link
              href="/admin/orders"
              className="text-xs text-terracotta hover:underline font-semibold whitespace-nowrap"
            >
              전체 보기 →
            </Link>
          }
        />

        {recentOrders.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            아직 주문이 없어요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-zinc-200">
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
                      className="border-b border-zinc-100 hover:bg-bg transition"
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

/* MetricCard 는 components/admin/ui.tsx 의 StatCard(도움말 포함)로 대체됨. */