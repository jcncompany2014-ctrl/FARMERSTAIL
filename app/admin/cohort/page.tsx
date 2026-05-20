import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronLeft,
  Users,
  Star,
  Repeat,
  RotateCcw,
  ClipboardCheck,
  PieChart as PieIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import {
  CohortReasonPie,
  CohortSkuRatingBar,
  CohortTrendLine,
} from './CohortCharts'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cohort 분석 — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/cohort — Phase 5: feeding_outcomes cohort 대시보드.
 *
 * # 카드
 *   1. 코호트별 outcome 카운트 (closed_beta / launch / rolling × source)
 *   2. 재주문율  (reorder count / first_order count)
 *   3. 환불율    (refund count / paid orders count)
 *   4. 별점 평균 (box_rating 평균 + 분포)
 *   5. 체크인 응답률 (first_box_checkin / 발송 가능 dog 수)
 *   6. 환불 사유 분포 (Pie — palatability / digestibility / outcome / price / lifestyle / other)
 *   7. SKU별 별점 매트릭스 (Bar)
 *   8. 시계열 outcome 추이 (Line — 최근 12주)
 *
 * # 데이터 출처
 *   - feeding_outcomes (RLS 우회 위해 service_role client 사용)
 *   - orders (재주문/환불 base metric)
 *   - dogs (cohort 분모)
 */
export default async function AdminCohortPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/cohort')
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  // service_role 로 RLS 우회 — generated types 에 아직 feeding_outcomes 없음 → cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  type OutcomeRow = {
    id: string
    dog_id: string
    user_id: string
    cohort_id: string
    source: string
    rating_stars: number | null
    reason_category: string | null
    sku_code: string | null
    palatability: string | null
    created_at: string
  }

  const [
    { data: outcomesRaw },
    { count: paidOrderCount },
    { count: dogCount },
    { count: deliveredOrderCount },
  ] = await Promise.all([
    admin
      .from('feeding_outcomes')
      .select(
        'id, dog_id, user_id, cohort_id, source, rating_stars, reason_category, sku_code, palatability, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid'),
    supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .not('delivered_at', 'is', null),
  ])

  const outcomes = (outcomesRaw ?? []) as OutcomeRow[]

  // ────────────────────────────────────────────────────────
  // 집계
  // ────────────────────────────────────────────────────────

  // 1. cohort × source 매트릭스
  const cohortMatrix = new Map<string, Map<string, number>>()
  for (const o of outcomes) {
    const m = cohortMatrix.get(o.cohort_id) ?? new Map<string, number>()
    m.set(o.source, (m.get(o.source) ?? 0) + 1)
    cohortMatrix.set(o.cohort_id, m)
  }
  const cohortIds = Array.from(cohortMatrix.keys()).sort()
  const sourceTypes = [
    'first_order',
    'first_box_checkin',
    'box_rating',
    'reorder',
    'subscription_pause',
    'subscription_cancel',
    'refund',
    'self_log',
  ]

  // 2. 재주문율 = reorder / first_order
  const firstOrderCount = outcomes.filter((o) => o.source === 'first_order').length
  const reorderCount = outcomes.filter((o) => o.source === 'reorder').length
  const reorderRate = firstOrderCount > 0 ? (reorderCount / firstOrderCount) * 100 : 0

  // 3. 환불율 = refund outcome / paid orders
  const refundOutcomeCount = outcomes.filter((o) => o.source === 'refund').length
  const refundRate = (paidOrderCount ?? 0) > 0
    ? (refundOutcomeCount / (paidOrderCount ?? 1)) * 100
    : 0

  // 4. 별점 평균
  const ratings = outcomes
    .filter((o) => o.source === 'box_rating' && o.rating_stars != null)
    .map((o) => o.rating_stars as number)
  const ratingAvg = ratings.length > 0
    ? ratings.reduce((s, n) => s + n, 0) / ratings.length
    : 0
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: ratings.filter((r) => r === star).length,
  }))

  // 5. 체크인 응답률 — 발송 대상은 first-box-checkin cron 이 7일 경과 paid order 에 푸시.
  // 단순화: delivered_at not null paid orders 수 vs first_box_checkin outcome 수.
  const checkinResponseCount = outcomes.filter(
    (o) => o.source === 'first_box_checkin',
  ).length
  const checkinEligible = deliveredOrderCount ?? 0
  const checkinRate = checkinEligible > 0
    ? (checkinResponseCount / checkinEligible) * 100
    : 0

  // 6. 환불 사유 분포 — refund + subscription_cancel
  const reasonRows = outcomes.filter(
    (o) => o.reason_category && (o.source === 'refund' || o.source === 'subscription_cancel'),
  )
  const reasonMap = new Map<string, number>()
  for (const r of reasonRows) {
    const k = r.reason_category ?? 'other'
    reasonMap.set(k, (reasonMap.get(k) ?? 0) + 1)
  }
  const reasonPieData = Array.from(reasonMap.entries()).map(([name, value]) => ({
    name: REASON_LABEL[name] ?? name,
    value,
  }))

  // 7. SKU별 별점 (rating_stars 기준)
  const skuRatings = new Map<string, number[]>()
  for (const o of outcomes) {
    if (o.source === 'box_rating' && o.sku_code && o.rating_stars != null) {
      const arr = skuRatings.get(o.sku_code) ?? []
      arr.push(o.rating_stars)
      skuRatings.set(o.sku_code, arr)
    }
  }
  const skuBarData = Array.from(skuRatings.entries())
    .map(([sku, arr]) => ({
      sku,
      avg: arr.reduce((s, n) => s + n, 0) / arr.length,
      n: arr.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)

  // 8. 시계열 — 최근 12주 outcome 추이 (week bucket).
  // Date.now() 는 component body 에서 직접 호출하면 react-hooks/purity rule 위반 →
  // helper 함수로 분리.
  const weekBuckets = buildWeekBuckets(outcomes)

  return (
    <div className="px-5 py-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
      >
        <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
        대시보드
      </Link>

      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-moss" strokeWidth={2} />
        <h1 className="font-['Archivo_Black'] text-2xl text-ink">
          COHORT INSIGHTS
        </h1>
      </div>
      <p className="text-[12px] text-muted mt-1">
        feeding_outcomes — 재주문 · 환불 · 별점 · 체크인 응답률 · SKU 비교
      </p>

      {/* 핵심 KPI 4종 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Kpi
          icon={<Repeat className="w-4 h-4" />}
          label="재주문율"
          value={`${reorderRate.toFixed(1)}%`}
          sub={`${reorderCount} / ${firstOrderCount}`}
        />
        <Kpi
          icon={<RotateCcw className="w-4 h-4" />}
          label="환불율"
          value={`${refundRate.toFixed(1)}%`}
          sub={`${refundOutcomeCount} / ${paidOrderCount ?? 0}`}
        />
        <Kpi
          icon={<Star className="w-4 h-4" />}
          label="별점 평균"
          value={ratings.length > 0 ? ratingAvg.toFixed(2) : '—'}
          sub={`${ratings.length}건`}
        />
        <Kpi
          icon={<ClipboardCheck className="w-4 h-4" />}
          label="체크인 응답률"
          value={`${checkinRate.toFixed(1)}%`}
          sub={`${checkinResponseCount} / ${checkinEligible}`}
        />
      </div>

      {/* 코호트 × source 매트릭스 */}
      <Card
        icon={<Users className="w-4 h-4" />}
        title={`코호트 × source 매트릭스 (총 ${outcomes.length}건 · 분모: dog ${dogCount ?? 0})`}
      >
        {cohortIds.length === 0 ? (
          <p className="text-[11.5px] text-muted">데이터 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-muted border-b border-rule">
                  <th className="py-1.5 pr-3 font-bold uppercase tracking-wider">cohort</th>
                  {sourceTypes.map((s) => (
                    <th key={s} className="py-1.5 px-2 font-bold text-right">
                      {SOURCE_SHORT[s] ?? s}
                    </th>
                  ))}
                  <th className="py-1.5 pl-2 font-bold text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {cohortIds.map((cid) => {
                  const m = cohortMatrix.get(cid)!
                  const total = sourceTypes.reduce((s, src) => s + (m.get(src) ?? 0), 0)
                  return (
                    <tr key={cid} className="border-b border-rule/40">
                      <td className="py-1.5 pr-3 font-mono text-ink">{cid}</td>
                      {sourceTypes.map((s) => (
                        <td
                          key={s}
                          className="py-1.5 px-2 text-right font-mono tabular-nums text-ink"
                        >
                          {m.get(s) ?? 0}
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 text-right font-mono tabular-nums font-bold text-ink">
                        {total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 별점 분포 */}
      <Card icon={<Star className="w-4 h-4" />} title="별점 분포 (box_rating)">
        {ratings.length === 0 ? (
          <p className="text-[11.5px] text-muted">아직 별점 없음</p>
        ) : (
          <div className="space-y-1.5">
            {ratingDist
              .slice()
              .reverse()
              .map(({ star, count }) => {
                const pct = (count / ratings.length) * 100
                return (
                  <div
                    key={star}
                    className="flex items-center gap-2 text-[11.5px]"
                  >
                    <span className="w-12 font-mono text-ink">
                      {'★'.repeat(star)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-bg">
                      <div
                        className="h-full rounded-full bg-terracotta"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-muted tabular-nums w-20 text-right">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </Card>

      {/* 환불 사유 Pie */}
      <Card
        icon={<PieIcon className="w-4 h-4" />}
        title={`환불 / 해지 사유 분포 (${reasonRows.length}건)`}
      >
        {reasonPieData.length === 0 ? (
          <p className="text-[11.5px] text-muted">환불·해지 사유 데이터 없음</p>
        ) : (
          <CohortReasonPie data={reasonPieData} />
        )}
      </Card>

      {/* SKU별 별점 Bar */}
      <Card
        icon={<Star className="w-4 h-4" />}
        title={`SKU별 별점 평균 (Top ${skuBarData.length})`}
      >
        {skuBarData.length === 0 ? (
          <p className="text-[11.5px] text-muted">SKU별 별점 데이터 없음</p>
        ) : (
          <CohortSkuRatingBar data={skuBarData} />
        )}
      </Card>

      {/* 시계열 12주 추이 */}
      <Card
        icon={<Repeat className="w-4 h-4" />}
        title="최근 12주 outcome 추이"
      >
        <CohortTrendLine data={weekBuckets} />
      </Card>

      <p className="text-[10.5px] text-muted mt-6 leading-relaxed">
        ※ outcome 수집은 사용자 부담 0 (자동 + 자발). 1주마다 매주 데이터 확인
        → SKU·레시피 개선 신호 활용.
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Helpers / UI primitives
// ────────────────────────────────────────────────────────────────

type OutcomeRowForBucket = {
  source: string
  rating_stars: number | null
  created_at: string
}

function buildWeekBuckets(
  outcomes: OutcomeRowForBucket[],
): Array<{ week: string; count: number; rating: number; ratingN: number }> {
  const now = Date.now()
  const buckets: Array<{
    week: string
    count: number
    rating: number
    ratingN: number
  }> = []
  for (let w = 11; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86_400_000
    const end = now - w * 7 * 86_400_000
    const slice = outcomes.filter((o) => {
      const t = new Date(o.created_at).getTime()
      return t >= start && t < end
    })
    const sliceRatings = slice
      .filter((o) => o.source === 'box_rating' && o.rating_stars != null)
      .map((o) => o.rating_stars as number)
    const label = new Date(end - 86_400_000)
      .toISOString()
      .slice(5, 10)
      .replace('-', '/')
    buckets.push({
      week: label,
      count: slice.length,
      rating:
        sliceRatings.length > 0
          ? sliceRatings.reduce((s, n) => s + n, 0) / sliceRatings.length
          : 0,
      ratingN: sliceRatings.length,
    })
  }
  return buckets
}

const REASON_LABEL: Record<string, string> = {
  not_eating: '안 먹어요',
  digestion_issue: '소화·변 문제',
  weight_change: '체중 변화',
  price: '가격',
  lifestyle: '배송·변심·일정',
  other: '기타',
}

const SOURCE_SHORT: Record<string, string> = {
  first_order: '첫주문',
  first_box_checkin: '체크인',
  box_rating: '별점',
  reorder: '재주문',
  subscription_pause: '일시정지',
  subscription_cancel: '해지',
  refund: '환불',
  self_log: '자발입력',
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-rule bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-terracotta mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
          {label}
        </span>
      </div>
      <p className="text-2xl font-['Archivo_Black'] text-ink tabular-nums">
        {value}
      </p>
      <p className="text-[10.5px] font-mono text-muted mt-0.5">{sub}</p>
    </div>
  )
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-5 rounded-2xl border border-rule bg-white p-5">
      <div className="flex items-center gap-2 mb-3 text-terracotta">
        {icon}
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">
          {title}
        </h2>
      </div>
      <div>{children}</div>
    </section>
  )
}
