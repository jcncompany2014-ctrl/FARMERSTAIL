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
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { COLLECTED_STATUSES } from '@/lib/commerce/paid-status'
import { isAdmin } from '@/lib/auth/admin'
import { HelpTip, AdminTabs, Hl } from '@/components/admin/ui'
import { REVENUE_TABS } from '@/components/admin/tabGroups'
import PrintButtonClient from './PrintButtonClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '매출 리포트 · 관리자',
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
  const user = await getRequestUser()
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
    { data: paidOrders, error: ordersErr },
    { data: refunds, error: refundsErr },
    { data: subCharges, error: chargesErr },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, total_amount, points_used, discount_amount, shipping_fee, paid_at, payment_method',
      )
      // ★gross 는 **환불된 주문까지** 포함해야 한다 — 환불액은 아래 refunds 에서
      //  따로 빼기 때문에, 여기서도 빼면 이중 차감이 된다. 부분 환불만 넣고
      //  전액 환불·고객 취소를 빼 두면 그 달 net 이 그 금액만큼 마이너스로
      //  어긋난다(2026-08-07). paid_at 범위 필터가 미결제 주문을 이미 거른다.
      .in('payment_status', COLLECTED_STATUSES)
      .gte('paid_at', monthStart)
      .lt('paid_at', monthEnd)
      .order('paid_at', { ascending: false }),
    // ★환불 합계는 **payment_events 원장**(음수 amount)에서 뺀다 (2026-08-20
    //   6라운드 감사). 예전엔 refunds 테이블만 봤는데, refunds 에 행을 남기는 건
    //   고객 self-cancel·admin partial-cancel 둘뿐이고 **자동환불 경로**
    //   (subscription-charge 청구중해지·refund-retry)는 payment_events 만 쓴다.
    //   그래서 자동환불이 net 에서 안 빠져 순매출이 그만큼 과대계상됐다. 모든
    //   환불 경로가 예외 없이 남기는 원장을 기준으로 통일한다("원장=1차 진실").
    supabase
      .from('payment_events')
      .select('amount, created_at')
      // ★환불 계열 event_type 만, 부호 제한 없이 (2026-09-05 이중 기록 수정과
      //   한 세트) — 부호만 보면 정보성 이벤트가 섞이고, 오기입 정정용 반대
      //   기입(+금액)은 부호 합산으로 자연 상쇄돼야 한다(회계식 reversal).
      .in('event_type', ['refunded', 'partial_refunded', 'cron_refund_queue'])
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
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
  }
  // ★조회 실패 표면화 (2026-09-05 전수감사, 규칙1) — 세무 기준 숫자가
  //   실패 시 0으로 위장되면 안 된다. 배너로 '못 봄'을 분리한다.
  const reportLoadFailed = Boolean(ordersErr || refundsErr || chargesErr)
  for (const [what, err] of [
    ['주문', ordersErr],
    ['환불 원장', refundsErr],
    ['정기결제', chargesErr],
  ] as const) {
    if (err) console.error(`[admin-reports] ${what} 조회 실패:`, err.message)
  }

  const orders = (paidOrders ?? []) as Order[]
  const refundEvents = (refunds ?? []) as Array<{ amount: number }>
  const charges = (subCharges ?? []) as Array<{ amount: number }>

  const grossRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  // 원장 환불 계열의 **부호 합산**(음수→양수 환불액, 정정 기입은 상쇄).
  const refundTotal = refundEvents.reduce((s, e) => s - (e.amount ?? 0), 0)
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
          <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
            매출 리포트
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <Hl>장사가 얼마나 됐는지 달별로</Hl> 보는 곳이에요 — 매출·환불·정기배송
            수를 한눈에 봐요. 오른쪽 인쇄 버튼으로 저장할 수 있어요.
          </p>
        </div>
        <PrintButtonClient />
      </div>

      {reportLoadFailed && (
        <div className="no-print mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-[12px] font-semibold text-destructive">
            일부 데이터를 불러오지 못했어요 — 아래 숫자가 실제보다 적을 수
            있어요(실제 0이 아님). 새로고침 후 다시 확인해 주세요. 이 상태로
            세무·정산에 쓰지 마세요.
          </p>
        </div>
      )}

      {/* 월 navigate */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-foreground" strokeWidth={2} />
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
            className="px-3 py-1.5 rounded-xl bg-card border border-border shadow-sm text-xs font-bold hover:border-zinc-800 transition"
          >
            ← 이전 달
          </Link>
          <Link
            href={nextHref}
            className="px-3 py-1.5 rounded-xl bg-card border border-border shadow-sm text-xs font-bold hover:border-zinc-800 transition"
          >
            다음 달 →
          </Link>
        </div>
      </div>

      {/* Hero 매출 카드 — 클린 zinc 다크 (2026-07 잔재청소: 웜브라운+골드 serif 제거)
          2026-10-24 어드민 금액 말 정리: 옛 영어·회계 말 대신 '매출(결제 − 환불)' = '결제 합계' − '환불' 한 줄 식으로. */}
      <section className="rounded-lg px-6 py-5 text-white mb-5 bg-zinc-900 print:break-inside-avoid print:bg-card print:text-foreground print:border print:border-input">
        <span className="inline-flex items-center gap-1 text-xs font-bold tracking-[-0.01em] text-white/70 print:text-muted-foreground">
          매출(결제 − 환불)
          <HelpTip text="이번 달 결제 합계에서 환불을 뺀, 실제로 남는 매출이에요. 할인은 결제할 때 이미 빠져 있어서 여기서 또 빼지 않아요. 세무 신고·운영 리뷰의 기준 숫자예요." />
        </span>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-bold leading-none tabular-nums tracking-tight text-white text-[40px] print:text-foreground">
            {netRevenue.toLocaleString()}
          </span>
          <span className="text-[16px] text-white/85 font-bold print:text-muted-foreground">
            원
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-white/60">결제 합계</span>
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
          kicker="1건 평균 결제 금액"
          value={aov}
          unit="원"
          Icon={Coins}
          tone="terracotta"
        />
        <ReportStat
          kicker="정기배송"
          value={subCount}
          unit="건"
          sub={`결제함 ${subRevenue.toLocaleString()}원`}
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

      {/* 할인은 '빼는 돈'이 아니라 참고 숫자 — 2026-10-24 어드민 금액 말 정리. 예전 '차감 항목'에 할인이 환불과 나란히 마이너스로
          있어서 매출에서 두 번 뺀 것처럼 보였다. 할인은 결제한 금액에 이미 반영돼 있고, 매출에서 빼는 건 위 카드의 환불 하나다. */}
      <section className="bg-card rounded-xl border border-border px-5 py-4 mb-6 print:break-inside-avoid">
        <div
          className={`grid gap-3 text-xs ${
            totalPointsUsed > 0 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <div>
            <span className="font-semibold text-muted-foreground">
              할인해 준 금액(이미 빠진 돈 · 참고)
            </span>
            <div className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
              {totalDiscount.toLocaleString()}원
            </div>
          </div>
          {/* 포인트는 폐지된 제도(2026-07-16) — 과거 이력이 있을 때만 표시. 할인처럼 결제 전에 이미 빠진 돈이다. */}
          {totalPointsUsed > 0 && (
            <div>
              <span className="font-semibold text-muted-foreground">
                포인트(없어진 제도 · 이미 빠진 돈)
              </span>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                {totalPointsUsed.toLocaleString()}원
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          결제할 때 이미 빠진 돈이라 위 매출에서 또 빼지 않아요. 매출에서 빼는 건 환불뿐이에요.
        </p>
      </section>

      {/* 많이 팔린 상품 — 2026-10-24 뺐다(정가 기준이라 입금과 달랐고, 박스가 강아지별 맞춤이라 상품 순위가 뜻이 없다. 규칙313). */}
      {/* 결제수단 분포 */}
      {methodCount.size > 0 && (
        <section className="mb-6 print:break-inside-avoid">
          <span className="block mb-2 text-xs font-bold text-muted-foreground">결제수단</span>
          <div className="bg-card rounded-xl border border-border px-4 py-3">
            {Array.from(methodCount.entries()).map(([method, count]) => {
              const pct =
                orderCount > 0 ? Math.round((count / orderCount) * 100) : 0
              return (
                <div key={method} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground">
                      {method}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
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

      <p className="text-xs text-muted-foreground text-center mt-8 no-print">
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
    moss: '#059669',
    muted: 'var(--adm-muted-foreground)',
  }
  const accent = colorMap[tone]
  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3.5">
      <div className="flex items-center gap-1">
        <Icon
          className="w-3 h-3"
          style={{ color: accent }}
          strokeWidth={2.5}
        />
        <span
          className="text-xs font-bold"
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
        <span className="text-xs text-muted-foreground ml-0.5 font-sans">
          {unit}
        </span>
      </div>
      {sub && (
        <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{sub}</div>
      )}
    </div>
  )
}

