/**
 * R64 — /admin/finance 일별 매출 dashboard.
 *
 * payment_events 원장에서 일별로 SUM. 원장이 insert-only 라 신뢰 가능.
 * paid 합 / refund 합 / 순매출 / 일 평균 객단가.
 *
 * 30일 / 60일 / 90일 토글.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs, StatCard, Hl, Em, LoadError } from '@/components/admin/ui'
import { REVENUE_TABS } from '@/components/admin/tabGroups'

export const dynamic = 'force-dynamic'

interface EventRow {
  event_type: string
  amount: number
  order_id: string
  created_at: string
}

// React 19 purity rule — Date.now() helper 외부 분리.
function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function dayKey(iso: string): string {
  // ★최종감사 #12 (2026-07-29): UTC 그대로 자르면 KST 00:00~08:59 결제가
  //   전날 버킷에 들어간다. 특히 정기결제는 화요일 새벽 KST 크론이라(= UTC
  //   월요일 밤) 주력 매출이 매주 월요일로 밀려 기록됐다 — 대시보드(KST)와
  //   숫자가 안 맞아 "결제가 안 됐나?" 오판을 만든다. admin/page.tsx ·
  //   reports 와 같은 +9h 방식으로 통일.
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = Math.min(Math.max(Number(params.days ?? '30'), 7), 365)
  const supabase = await createClient()

  // payment_events fetch — RLS 가 admin 만 허용.
  const client = supabase.from('payment_events' as never) as unknown as {
    select: (cols: string) => {
      gte: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: EventRow[] | null
            // ★error 포함 (2026-09-05 전수감사, 규칙1) — 예전 cast 는 {data}만
            //   있어서 조회 실패가 '매출 0원'으로 위장됐다.
            error: { message: string } | null
          }>
        }
      }
    }
  }
  const { data: rawEvents, error: ledgerErr } = await client
    .select('event_type, amount, order_id, created_at')
    .gte('created_at', sinceIso(days))
    .order('created_at', { ascending: true })
    .limit(50000)
  if (ledgerErr) {
    console.error('[admin-finance] 원장 조회 실패:', ledgerErr.message)
  }

  const events = (rawEvents ?? []) as EventRow[]

  // ★집계는 event_type 화이트리스트로 (2026-09-05 이중 기록 수정과 한 세트).
  //   부호만 보면 정보성·보정(admin_action) 이벤트까지 매출/환불에 섞인다 —
  //   과거 이중 기록의 상쇄용 보정 기입(+금액)이 매출로 잡히면 안 된다.
  //   매출 = 'paid', 환불 = refunded 계열 3종(모든 환불 경로가 이 중 하나).
  const REFUND_TYPES = new Set([
    'refunded',
    'partial_refunded',
    'cron_refund_queue',
  ])

  // 일별 집계
  type DayBucket = {
    date: string
    paid: number
    refunded: number
    net: number
    orderCount: Set<string>
  }
  const buckets = new Map<string, DayBucket>()
  let totalPaid = 0
  let totalRefunded = 0
  const uniqueOrderIds = new Set<string>()

  for (const e of events) {
    const day = dayKey(e.created_at)
    let bucket = buckets.get(day)
    if (!bucket) {
      bucket = {
        date: day,
        paid: 0,
        refunded: 0,
        net: 0,
        orderCount: new Set(),
      }
      buckets.set(day, bucket)
    }
    if (e.event_type === 'paid' && e.amount > 0) {
      bucket.paid += e.amount
      totalPaid += e.amount
      bucket.orderCount.add(e.order_id)
      uniqueOrderIds.add(e.order_id)
    } else if (REFUND_TYPES.has(e.event_type)) {
      // 부호 합산 — 환불(-)은 더해지고, 오기입 정정용 반대 기입(+)은 자연
      // 상쇄된다(회계식 reversal). 절대값 합산이면 정정이 반영되지 않는다.
      bucket.refunded += -e.amount
      totalRefunded += -e.amount
    }
    bucket.net = bucket.paid - bucket.refunded
  }

  const dayList = [...buckets.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
  const netTotal = totalPaid - totalRefunded
  const orderCount = uniqueOrderIds.size
  const avgOrderValue = orderCount === 0 ? 0 : Math.round(totalPaid / orderCount)
  const refundRate = totalPaid === 0 ? 0 : (totalRefunded / totalPaid) * 100

  // 차트용 max
  const maxNet = Math.max(...dayList.map((d) => d.net), 1)

  return (
    <div>
      {/* 대개편 v2 T3 — 매출·결제 그룹 탭 (뒤로가기 링크 대체·헤더 zinc 통일) */}
      <AdminTabs tabs={REVENUE_TABS} active="/admin/finance" />
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">결제 원장</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          <Hl>실제 카드 결제 기록</Hl>을 하루 단위로 쌓아 보여주는 곳이에요 —{' '}
          <Em>토스에서 승인된 금액 기준</Em>이라 &lsquo;진짜 들어온 돈&rsquo;에
          가장 가까워요 (최근 <Em>{days}일</Em>).
        </p>
        <div className="flex gap-2 mt-3 text-xs">
          {[7, 30, 60, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/admin/finance?days=${d}`}
              className={`rounded border px-3 py-1.5 ${
                days === d
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-border hover:border-ring'
              }`}
            >
              {d}일
            </Link>
          ))}
        </div>
      </div>

      {ledgerErr && (
        <div className="mb-4">
          <LoadError
            what="결제 원장"
            hint="아래 숫자가 전부 0으로 보이는 건 매출이 없어서가 아니라 조회가 실패한 상태예요. 새로고침해 주세요."
          />
        </div>
      )}

      {/* KPI 그리드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="총 매출"
          value={totalPaid.toLocaleString()}
          unit="원"
          help="기간 내 결제 완료된 주문 금액의 합이에요(환불 빼기 전)."
        />
        <StatCard
          label="총 환불"
          value={totalRefunded.toLocaleString()}
          unit="원"
          tone={totalRefunded > 0 ? 'red' : 'neutral'}
          help="기간 내 고객에게 환불해준 금액의 합이에요."
        />
        <StatCard
          label="순 매출"
          value={netTotal.toLocaleString()}
          unit="원"
          tone="green"
          help="총 매출에서 환불을 뺀, 실제로 남은 매출이에요."
        />
        <StatCard
          label="객단가 평균"
          value={avgOrderValue.toLocaleString()}
          unit="원"
          sub={`주문 ${orderCount}건 / 환불률 ${refundRate.toFixed(1)}%`}
          help="주문 1건당 평균 결제 금액이에요(총 매출 ÷ 주문 수)."
        />
      </section>

      {/* 일별 매출 차트 + 표 */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">일별 순매출</h2>
        {dayList.length === 0 ? (
          <p className="text-xs text-muted-foreground py-5 text-center">
            기간 내 결제 이벤트가 없어요.
          </p>
        ) : (
          <div className="space-y-2">
            {dayList.map((d) => {
              const pct = (d.net / maxNet) * 100
              return (
                <div key={d.date} className="text-xs">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-foreground font-mono">{d.date}</span>
                    <span className="text-muted-foreground">
                      결제 {d.paid.toLocaleString()}원
                      {d.refunded > 0 && (
                        <span className="text-destructive ml-2">
                          -{d.refunded.toLocaleString()}원
                        </span>
                      )}
                      <span className="ml-2 text-foreground font-semibold">
                        순매출 {d.net.toLocaleString()}원
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        ({d.orderCount.size}건)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded">
                    <div
                      className="h-2 bg-emerald-600 rounded"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// Kpi 로컬 정의 제거(2026-07-25 마스터피스) — ui.tsx StatCard 로 통합.
