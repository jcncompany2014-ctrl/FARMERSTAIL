import Link from 'next/link'
import {
  LayoutDashboard,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/products/stock'
import RevenueChart, { type RevenuePoint } from '@/components/admin/RevenueChart'
import FoodInfoCompletion, {
  type ProductInfoLite,
} from '@/components/admin/FoodInfoCompletion'
import ActionsPanel from '@/components/admin/ActionsPanel'
import { Badge } from '@/components/adminui/badge'
import { Card, CardContent } from '@/components/adminui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/adminui/table'
import {
  tossKeyStatus,
  describeTossKeyStatus,
} from '@/lib/payments/key-mode'
import {
  formatKstShortDateTime as formatDate,
  todayKstIsoDate,
} from '@/lib/datetime-kst'
import { PAID_STATUSES, isPaidStatus, netPaidAmount } from '@/lib/commerce/paid-status'
import { findMissedCrons, type CronEntry } from '@/lib/cron-watchdog'
import vercelConfig from '@/vercel.json'

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
  // ★결제 상태 판정은 정본(isPaidStatus)으로 (2026-08-19 5라운드 감사).
  //   예전엔 `paymentStatus !== 'paid'` 자체 판정이라, 부분환불(박스는 나가는
  //   결제됨 주문)과 전액취소가 전부 회색 '결제 전'으로 떴다 — 홈 최근주문 표가
  //   결제 이력을 거짓 표시하고, 발송할 주문 카드 숫자와 배지가 모순됐다.
  // 색은 /admin/orders 목록의 statusBadge 와 같은 토큰 팔레트(화면 간 일관).
  if (paymentStatus === 'cancelled') {
    return { label: '취소', cls: 'bg-destructive text-white border-transparent' }
  }
  if (paymentStatus === 'failed') {
    return { label: '결제 실패', cls: 'bg-red-100 text-red-900 border-transparent' }
  }
  if (!isPaidStatus(paymentStatus)) {
    // pending 등 — 아직 결제 안 됨.
    return { label: '결제 전', cls: 'bg-secondary text-secondary-foreground border-transparent' }
  }
  if (paymentStatus === 'partially_refunded') {
    return { label: '부분환불', cls: 'bg-amber-100 text-amber-900 border-transparent' }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', cls: 'bg-primary text-primary-foreground border-transparent' }
    case 'shipping':
      return { label: '배송 중', cls: 'bg-emerald-600 text-white border-transparent' }
    case 'delivered':
      return { label: '완료', cls: 'bg-emerald-100 text-emerald-900 border-transparent' }
    case 'cancelled':
      return { label: '취소', cls: 'bg-destructive text-white border-transparent' }
    default:
      return {
        label: STATUS_LABEL[orderStatus] ?? orderStatus,
        cls: 'bg-secondary text-secondary-foreground border-transparent',
      }
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
    // 누적 매출 — 부분 환불분을 뺀 실수령액(lib/commerce/paid-status).
    // 예전엔 'paid' 만 세서 1,000원만 부분 환불해도 그 주문 전액이 매출에서
    // 사라졌다.
    supabase
      .from('orders')
      .select('total_amount, refunded_amount', { count: 'exact' })
      .in('payment_status', PAID_STATUSES),

    // 오늘 주문 수 — ★결제된 것만 (2026-09-05 전수감사). 카드 문구가
    // "오늘 결제된 주문 N건"인데 예전엔 pending·failed·취소까지 세서
    // 매출(=PAID_STATUSES 기준)과 분모가 달랐다.
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', PAID_STATUSES)
      .gte('created_at', todayStart),

    // 배송 대기 (preparing 상태) — 부분 환불된 주문도 박스는 나가야 한다.
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', PAID_STATUSES)
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
      .select('id, total_amount, refunded_amount, created_at, order_items(product_id, product_name, product_image_url, quantity, line_total)')
      .in('payment_status', PAID_STATUSES)
      .gte('created_at', thirtyDaysAgo),

    // 활성 구독 — MRR 추정. ★카드 등록(billing_key) 된 구독만: 카드 미등록
    // 구독은 청구가 한 번도 안 일어나는 '신청만' 상태라 매출 추정에 넣으면
    // MRR 이 과대계상된다(2026-07-19 검수).
    supabase
      .from('subscriptions')
      .select('id, total_amount', { count: 'exact' })
      .eq('status', 'active')
      .not('billing_key', 'is', null),

    // 재고 경고 — 개별 상품 stock <= LOW_THRESHOLD 인 수.
    // ★활성 상품만 (2026-09-05 전수감사). 쌍둥이 지표인 품절 카운트가
    // is_active=true 를 거는데 여기만 안 걸어서, 단종·숨김 상품(연어 제거분
    // 등)이 경고 목록을 영구 점유하고 두 숫자의 모집단이 달랐다.
    supabase
      .from('products')
      .select('id, name, slug, stock', { count: 'exact' })
      .eq('is_active', true)
      .lte('stock', STOCK_LOW_THRESHOLD)
      .order('stock', { ascending: true })
      .limit(5),

    // 최근 7일 주문 매출
    supabase
      .from('orders')
      .select('total_amount, refunded_amount')
      .in('payment_status', PAID_STATUSES)
      .gte('created_at', sevenDaysAgo),

    // 전전주 (14~7일 전) 주문 매출 — WoW 비교
    supabase
      .from('orders')
      .select('total_amount, refunded_amount')
      .in('payment_status', PAID_STATUSES)
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

    // 30일 해지 구독 — cancelled_at 30일 내 (2026-08-19 5라운드 감사).
    //   ★예전엔 updated_at 근사였다. updated_at 은 배치 UPDATE 마다 갱신돼
    //   마이그레이션이 돌 때마다 과거 해지가 '최근 30일'로 재집계됐다(존재하지
    //   않는 해지 급증). cancelled_at 은 트리거가 해지 시점에만 찍으므로 정확.
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('cancelled_at', thirtyDaysAgo),

    // 오늘 매출 — 실수령액 기준(부분 환불분 차감), created_at >= 오늘 0시
    supabase
      .from('orders')
      .select('total_amount, refunded_amount')
      .in('payment_status', PAID_STATUSES)
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
    csUnansweredRes,
  ] = await Promise.all([
    // preparing + 결제됨 + 24h+ → 발송 stale (부분 환불 포함)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('payment_status', PAID_STATUSES)
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
    // 답 안 한 1:1 문의 — 고객이 기다리는 일인데 대시보드에 없었다(2026-08-07).
    // ★단위는 **사람 수**다. /admin/cs-inbox 가 사용자별로 묶어 "N명" 을
    //  보여주므로, 여기서 메시지 행 수를 세면 한 고객이 3번 보냈을 때
    //  대시보드 "3" / 문의함 "1명" 으로 두 화면이 다른 말을 한다.
    supabase
      .from('cs_messages')
      .select('user_id')
      .eq('sender', 'user')
      .is('read_at', null)
      .limit(500),
  ])

  /**
   * 안 돈 자동작업 — 실패와 다른 문제다(위 cronFailRes 는 status='error' 만 센다).
   * 크론이 401 로 막히면 cron_health 에 행이 아예 안 생겨 "실패 0건"이 된다.
   */
  const { data: cronRecentRows, error: cronRecentErr } = await supabase
    .from('cron_health')
    .select('path, executed_at')
    .gte('executed_at', new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString())
    .limit(2000)
  const missedCronCount = (() => {
    try {
      return findMissedCrons(
        (vercelConfig as { crons: CronEntry[] }).crons,
        ((cronRecentRows ?? []) as Array<{ path: string; executed_at: string }>),
        new Date(now.getTime() - 25 * 60 * 60 * 1000),
        new Date(now.getTime() - 60 * 60 * 1000),
      ).length
    } catch (e) {
      // ★'조용한 0' 감시 장치가 스스로 조용히 0 을 내면 안 된다(2026-09-05
      //   전수감사). 판정 실패는 서버 로그에 남기고, 조회 실패(cronRecentErr)는
      //   아래 queueLoadFailed 배너로 화면에도 표시된다.
      console.error('[admin-home] 크론 감시 판정 실패:', e)
      return 0
    }
  })()

  // 답 안 한 문의 = **사람 수**(문의함 화면과 같은 단위).
  const csUnansweredUserCount = new Set(
    ((csUnansweredRes.data ?? []) as Array<{ user_id: string }>).map(
      (m) => m.user_id,
    ),
  ).size

  // 식품정보고시 14항목 채움률 — 별도 쿼리. 100개 이하 가정.
  const { data: foodInfoProducts, error: foodInfoErr } = await supabase
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

  // 코호트 리텐션/LTV RPC 는 홈에서 제거(2026-07-25). 표를 안 그리므로 조회할
  // 이유가 없다 — 홈 로딩에서 무거운 RPC 2건이 빠진다. 두 지표는
  // /admin/cohort 에서 그대로 본다.

  // ── ★조회 실패 표면화 (2026-09-05 전수감사, AGENTS.md 규칙1) ──────────
  // 이 화면의 24개 쿼리는 전부 `.count ?? 0`/`.data ?? []` 로 접혀 있어서,
  // 조회가 실패하면 처리 대기가 '모두 처리됨', 매출이 '0원'으로 **위장**됐다.
  // '없음'과 '못 봄'을 그룹 단위로 가른다: 지표 그룹 / 처리 대기 그룹 각각
  // 실패 여부를 계산해 배너로 표시하고, 빈 상태 문구가 있는 섹션(최근 주문·
  // 재고 부족·Top 상품·식품정보고시)은 각자 오류 상태를 따로 그린다.
  const statResults = [
    paidOrdersRes,
    todayOrdersRes,
    pendingShipRes,
    usersRes,
    thirtyDayOrdersRes,
    activeSubscriptionsRes,
    lastWeekOrdersRes,
    prevWeekOrdersRes,
    failedOrdersRes,
    newSubsRes,
    churnedSubsRes,
    todayRevenueRes,
  ]
  const statsLoadFailed = statResults.some((r) => r.error)
  const queueResults = [
    unshippedRes,
    shippingStuckRes,
    cardRenewalRes,
    recentFailedChargeRes,
    refundsPendingRes,
    stockOutRes,
    cronFailRes,
    noCardSubsRes,
    csUnansweredRes,
  ]
  const queueLoadFailed =
    queueResults.some((r) => r.error) || Boolean(cronRecentErr)
  for (const r of [
    ...statResults,
    ...queueResults,
    recentOrdersRes,
    lowStockRes,
  ]) {
    if (r.error) console.error('[admin-home] 조회 실패:', r.error.message)
  }
  if (cronRecentErr)
    console.error('[admin-home] cron_health 조회 실패:', cronRecentErr.message)
  if (foodInfoErr)
    console.error('[admin-home] 식품정보고시 조회 실패:', foodInfoErr.message)

  const totalRevenue =
    paidOrdersRes.data?.reduce((sum, o) => sum + netPaidAmount(o), 0) ?? 0
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
  const todayRevenue = (todayRevenueRes.data ?? []).reduce(
    (s, o) => s + netPaidAmount(o),
    0,
  )

  // WoW 매출 변화
  const lastWeekRevenue = (lastWeekOrdersRes.data ?? []).reduce(
    (s, o) => s + netPaidAmount(o),
    0,
  )
  const prevWeekRevenue = (prevWeekOrdersRes.data ?? []).reduce(
    (s, o) => s + netPaidAmount(o),
    0,
  )
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
    refunded_amount: number | null
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
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + netPaidAmount(o))
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
    <div className="grid gap-4">
      {/* 헤더 — orders/refunds 와 같은 패턴(lucide 아이콘 + xl/2xl 제목) */}
      <div>
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-primary" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            대시보드
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {`${todayKst.slice(0, 4)}년 ${Number(todayKst.slice(5, 7))}월 ${Number(todayKst.slice(8, 10))}일 기준 — 오늘 처리할 일과 매출·구독 현황을 한눈에 봐요. 바로 아래 '처리 대기'에 뜨는 건 그날 꼭 확인해 주세요.`}
        </p>
      </div>

      {/* 결제 모드 — 지금 진짜 돈이 오가는 설정인지(2026-07-26 결제 경로 감사).
          테스트키인 채로 출시하면 "결제 완료" 인데 입금이 없고, 키 짝이 안 맞으면
          고객이 카드를 긁은 뒤 승인이 거부된다. 둘 다 첫 실결제에서만 드러나는
          종류라 항상 보이는 자리에 띄운다. 정상(실결제 모드)일 땐 조용히 한 줄. */}
      {(() => {
        const s = tossKeyStatus(
          process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
          process.env.TOSS_SECRET_KEY,
        )
        const d = describeTossKeyStatus(s)
        const tone =
          d.tone === 'ok'
            ? 'text-muted-foreground'
            : d.tone === 'warn'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-destructive/40 bg-destructive/5 text-destructive'
        const Icon =
          d.tone === 'ok'
            ? CheckCircle2
            : d.tone === 'warn'
              ? AlertTriangle
              : ShieldAlert
        return (
          <Card className={`gap-0 py-3 ${d.tone === 'ok' ? '' : tone}`}>
            <CardContent className="px-4">
              <p
                className={`flex items-center gap-1.5 text-[13px] font-bold ${d.tone === 'ok' ? tone : ''}`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2.2} />
                {d.title}
              </p>
              {d.tone !== 'ok' && (
                // 본문을 아이콘 폭만큼 들여 제목과 좌측 라인을 맞춘다(시각 QA).
                <p className="mt-1 pl-[22px] text-[12px] leading-relaxed">
                  {d.detail}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* 처리 대기 큐 — admin hot path. ★조회 실패 시 '모두 처리됨'으로
          위장되면 안 되므로 배너로 '못 봄'을 분리 표시(규칙1). */}
      <div>
        {queueLoadFailed && (
          <QueryErrorCard
            what="처리 대기 카운트 일부"
            detail="아래 '처리 대기' 숫자가 실제보다 적게 보일 수 있어요 — 0이어도 '없음'이 아닐 수 있습니다. 새로고침해 주세요."
          />
        )}
        <ActionsPanel
          unshippedCount={unshippedRes.count ?? 0}
          shippingStuckCount={shippingStuckRes.count ?? 0}
          cardRenewalCount={cardRenewalRes.count ?? 0}
          recentFailedCount={recentFailedChargeRes.count ?? 0}
          refundsPendingCount={refundsPendingRes.count ?? 0}
          stockOutCount={stockOutRes.count ?? 0}
          cronFailureCount={cronFailRes.count ?? 0}
          csUnansweredCount={csUnansweredUserCount}
          missedCronCount={missedCronCount}
        />
      </div>

      {statsLoadFailed && (
        <QueryErrorCard
          what="지표 일부"
          detail="아래 매출·구독 숫자 일부가 0으로 보일 수 있어요 — 실제 0이 아니라 조회가 실패한 상태예요. 새로고침해 주세요."
        />
      )}

      {/* 오늘·전체 한눈에 — 쉬운 라벨 + 도움말(?) */}
      <section>
        <Kicker>한눈에 보기</Kicker>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      </section>

      {/* 구독 현황 — 정기배송이 이 사업의 핵심 매출원 */}
      <section>
        <Kicker>구독 현황</Kicker>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            sub={
              churnRatePct === 0
                ? '해지율 0%'
                : `해지율 ${churnRatePct.toFixed(1)}%`
            }
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
      </section>

      {/* 운영 체크 — 매일 확인하면 좋은 숫자 */}
      <section>
        <Kicker>운영 체크</Kicker>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
          {/* 2열(모바일)에서 3번째 카드가 반폭 고아로 남지 않게 전폭으로
              (2026-09-05 시각 QA — 오른쪽 빈칸이 어색했다). */}
          <div className="col-span-2 lg:col-span-1">
            <StatCard
              label="결제 실패 (30일)"
              value={`${failedOrderCount}건`}
              sub="카드 문제 등으로 실패"
              tone={failedOrderCount > 0 ? 'red' : 'neutral'}
              help="카드 한도·유효기간 만료 등으로 결제가 안 된 건이에요. 많으면 고객에게 안내가 필요해요."
            />
          </div>
        </div>
      </section>

      {/* 30일 매출 — SVG line chart (RevenueChart) */}
      <RevenueChart data={dailyChartData} title="최근 30일 매출" />

      {/* 식품정보고시 채움률 — 채움률 < 100% 면 시정명령 위험.
          ★조회 실패 시 채움률 0% 로 위장되면 안 된다 — 오류 카드로 분리. */}
      {foodInfoErr ? (
        <QueryErrorCard
          what="식품정보고시 채움률"
          detail="상품 표시 정보 조회가 실패했어요 — 채움률이 낮아진 게 아니에요. 새로고침해 주세요."
        />
      ) : (
        <FoodInfoCompletion products={productInfo} />
      )}

      {/* 코호트 리텐션·LTV 표는 홈에서 제거(사장님 2026-07-25).
          ① 주차 컬럼이 7개인 넓은 표라 폰에서 홈 전체가 옆으로 밀렸다.
          ② 매일 볼 지표가 아니다 — /admin/cohort(가입 시기별 분석)로 옮겼다.
          거기서 시인성(고정 팔레트·대비 보장)까지 고쳐 두었다. */}

      {/* Top 상품 + 재고 경고 — 2-column */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="많이 나간 상품 (최근 30일)"
          desc="최근 30일간 매출이 큰 상품 순서예요."
          action={
            <Link
              href="/admin/products"
              className="whitespace-nowrap text-xs font-semibold text-primary hover:underline"
            >
              상품 관리 →
            </Link>
          }
        >
          {thirtyDayOrdersRes.error ? (
            <p className="py-6 text-center text-sm text-destructive">
              판매 데이터를 불러오지 못했어요 — 새로고침해 주세요
            </p>
          ) : topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              30일 내 판매가 없어요
            </p>
          ) : (
            <ol className="space-y-2">
              {topProducts.map((p, idx) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b border-border py-2 last:border-b-0"
                >
                  <span className="w-5 text-sm font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.qty.toLocaleString()}개 판매
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold text-primary tabular-nums">
                    {p.revenue.toLocaleString()}원
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard
          title="재고 부족 상품"
          desc={`재고가 ${STOCK_LOW_THRESHOLD}개 이하로 남은 상품이에요. 품절 전에 채워주세요.`}
          action={
            lowStockCount > 5 ? (
              <Link
                href="/admin/products"
                className="whitespace-nowrap text-xs font-semibold text-primary hover:underline"
              >
                {lowStockCount}건 전체 →
              </Link>
            ) : undefined
          }
        >
          {lowStockRes.error ? (
            <p className="py-6 text-center text-sm text-destructive">
              재고 정보를 불러오지 못했어요 — 새로고침해 주세요
            </p>
          ) : lowStockItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              모든 상품 재고가 안전 범위예요
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${item.id}`}
                      className="block truncate text-sm hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      /products/{item.slug}
                    </p>
                  </div>
                  <Badge
                    className={
                      item.stock <= 0
                        ? 'bg-destructive text-white border-transparent'
                        : 'bg-amber-100 text-amber-900 border-transparent'
                    }
                  >
                    {item.stock <= 0 ? '품절' : `${item.stock}개`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 최근 주문 — md 이상 테이블, 모바일은 카드 리스트(폰 운영·탭타겟). */}
      <SectionCard
        title="최근 들어온 주문"
        desc="가장 최근 주문 10건이에요. 주문을 누르면 자세히 볼 수 있어요."
        action={
          <Link
            href="/admin/orders"
            className="whitespace-nowrap text-xs font-semibold text-primary hover:underline"
          >
            전체 보기 →
          </Link>
        }
      >
        {recentOrdersRes.error ? (
          <p className="py-6 text-center text-sm text-destructive">
            최근 주문을 불러오지 못했어요 — 새로고침해 주세요
          </p>
        ) : recentOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            아직 주문이 없어요
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>주문자</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="text-right">시각</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => {
                    const badge = statusBadge(o.payment_status, o.order_status)
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-[11px]">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="hover:text-primary"
                          >
                            {o.order_number}
                          </Link>
                        </TableCell>
                        <TableCell>{o.recipient_name}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {o.total_amount.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={badge.cls}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground tabular-nums">
                          {formatDate(o.created_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="space-y-2 md:hidden">
              {recentOrders.map((o) => {
                const badge = statusBadge(o.payment_status, o.order_status)
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="block rounded-lg border border-border bg-card px-3 py-2.5 transition hover:border-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px]">
                          {o.order_number}
                        </span>
                        <Badge className={`shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate text-muted-foreground">
                          {o.recipient_name} ·{' '}
                          <span className="tabular-nums">
                            {formatDate(o.created_at)}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {o.total_amount.toLocaleString()}원
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </SectionCard>
    </div>
  )
}

/* ── 로컬 부품 (adminui Card 기반 — refunds/page.tsx 패턴) ─────────────── */

/**
 * 도움말 툴팁 — CSS hover 전용(클라이언트 JS 불필요 → 서버 컴포넌트 동작).
 * components/admin/ui.tsx 의 HelpTip 과 같은 동작, 색만 --adm- 토큰.
 */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="group/help relative inline-flex align-middle">
      {/* ⚠️ bg-muted 금지 — --color-muted 는 (웹 보호 때문에) 사이트의 어두운
          텍스트 토큰에 매핑돼 있어 어드민에서 검은 점으로 렌더된다.
          어드민 표면색은 secondary 를 쓴다(globals.css @theme inline 참조). */}
      <span
        className="ml-1 inline-flex h-3.5 w-3.5 cursor-help select-none items-center justify-center rounded-full bg-secondary text-[9px] font-bold leading-none text-secondary-foreground"
        aria-hidden="true"
      >
        ?
      </span>
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-56 rounded-lg bg-foreground px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-background opacity-0 shadow-xl transition-opacity duration-150 group-hover/help:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

const STAT_TONE_TEXT = {
  neutral: '',
  green: 'text-emerald-600',
  red: 'text-destructive',
  amber: 'text-amber-600',
} as const

function StatCard({
  label,
  value,
  sub,
  help,
  tone = 'neutral',
}: {
  label: string
  value: string
  sub?: string
  help?: string
  tone?: keyof typeof STAT_TONE_TEXT
}) {
  return (
    <Card className="h-full gap-1 py-3.5">
      <CardContent className="px-4">
        <p className="flex items-center text-[11px] font-bold text-muted-foreground">
          <span>{label}</span>
          {help && <HelpTip text={help} />}
        </p>
        <p
          className={`mt-1 text-xl font-extrabold leading-tight tracking-tight tabular-nums md:text-2xl ${STAT_TONE_TEXT[tone]}`}
        >
          {value}
        </p>
        {sub != null && (
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** 섹션 라벨 — refunds 의 kicker 스타일 통일. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  )
}

/** 섹션 카드 — 제목 + 쉬운 설명 + 우측 액션 + 본문. */
function SectionCard({
  title,
  desc,
  action,
  children,
}: {
  title: string
  desc?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="px-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold">{title}</h2>
            {desc != null && (
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                {desc}
              </p>
            )}
          </div>
          {action != null && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * 조회 실패 배너 — '없음'과 '못 봄'을 가르는 장치(AGENTS.md 규칙1).
 * refunds 데드레터 카드와 같은 destructive 톤.
 */
function QueryErrorCard({ what, detail }: { what: string; detail: string }) {
  return (
    <Card className="mb-3 gap-0 border-destructive/40 bg-destructive/5 py-3">
      <CardContent className="px-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-destructive">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={2.2} />
          {what}을(를) 불러오지 못했어요
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  )
}