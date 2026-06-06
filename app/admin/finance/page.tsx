/**
 * R64 — /admin/finance 일별 매출 dashboard.
 *
 * payment_events 원장에서 일별로 SUM. 원장이 insert-only 라 신뢰 가능.
 * paid 합 / refund 합 / 순매출 / 일 평균 객단가.
 *
 * 30일 / 60일 / 90일 토글.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

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
  return iso.slice(0, 10) // YYYY-MM-DD
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
          limit: (n: number) => Promise<{ data: EventRow[] | null }>
        }
      }
    }
  }
  const { data: rawEvents } = await client
    .select('event_type, amount, order_id, created_at')
    .gte('created_at', sinceIso(days))
    .order('created_at', { ascending: true })
    .limit(50000)

  const events = (rawEvents ?? []) as EventRow[]

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
    if (e.amount > 0) {
      bucket.paid += e.amount
      totalPaid += e.amount
      bucket.orderCount.add(e.order_id)
      uniqueOrderIds.add(e.order_id)
    } else if (e.amount < 0) {
      bucket.refunded += Math.abs(e.amount)
      totalRefunded += Math.abs(e.amount)
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
      <div className="mb-5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-mute hover:text-terracotta font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          관리자
        </Link>
        <h1 className="font-['Archivo_Black'] text-3xl text-ink mt-2">FINANCE</h1>
        <p className="text-xs text-mute mt-1">
          결제 기록을 기준으로 한 하루별 매출이에요 (최근 {days}일).
        </p>
        <div className="flex gap-2 mt-3 text-xs">
          {[7, 30, 60, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/admin/finance?days=${d}`}
              className={`rounded border px-3 py-1.5 ${
                days === d
                  ? 'border-terracotta text-terracotta bg-terracotta/5'
                  : 'border-line hover:border-ink/40'
              }`}
            >
              {d}일
            </Link>
          ))}
        </div>
      </div>

      {/* KPI 그리드 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="총 매출" value={`${totalPaid.toLocaleString()}원`} />
        <Kpi
          label="총 환불"
          value={`${totalRefunded.toLocaleString()}원`}
          tone={totalRefunded > 0 ? 'sale' : undefined}
        />
        <Kpi
          label="순 매출"
          value={`${netTotal.toLocaleString()}원`}
          tone="moss"
        />
        <Kpi
          label="객단가 평균"
          value={`${avgOrderValue.toLocaleString()}원`}
          hint={`주문 ${orderCount}건 / 환불률 ${refundRate.toFixed(1)}%`}
        />
      </section>

      {/* 일별 매출 차트 + 표 */}
      <section className="rounded border border-line p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">일별 순매출</h2>
        {dayList.length === 0 ? (
          <p className="text-xs text-mute py-5 text-center">
            기간 내 결제 이벤트가 없어요.
          </p>
        ) : (
          <div className="space-y-2">
            {dayList.map((d) => {
              const pct = (d.net / maxNet) * 100
              return (
                <div key={d.date} className="text-xs">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-ink font-mono">{d.date}</span>
                    <span className="text-mute">
                      결제 {d.paid.toLocaleString()}원
                      {d.refunded > 0 && (
                        <span className="text-sale ml-2">
                          -{d.refunded.toLocaleString()}원
                        </span>
                      )}
                      <span className="ml-2 text-ink font-semibold">
                        순매출 {d.net.toLocaleString()}원
                      </span>
                      <span className="ml-2 text-mute">
                        ({d.orderCount.size}건)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-paperHi rounded">
                    <div
                      className="h-2 bg-moss rounded"
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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'sale' | 'moss'
}) {
  const color =
    tone === 'sale' ? 'text-sale' : tone === 'moss' ? 'text-moss' : 'text-ink'
  return (
    <div className="rounded border border-line p-4">
      <div className="text-[10px] uppercase tracking-wider text-mute font-semibold">
        {label}
      </div>
      <div className={`text-xl mt-1.5 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-mute mt-1.5">{hint}</div>}
    </div>
  )
}
