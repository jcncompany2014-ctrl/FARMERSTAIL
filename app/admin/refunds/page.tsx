import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { redirect } from 'next/navigation'
import {
  RefreshCcw,
  ArrowLeft,
  Calendar,
  TrendingDown,
  AlertTriangle,
  Check,
  Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '환불 관리 — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/refunds — 환불 audit log 한 화면.
 *
 * 솔로 운영자가 환불 history / 통계 / pending 처리를 한눈에 보게.
 * refunds 테이블 (마이그레이션 20260506000003) 데이터를 시각화.
 *
 * # 표시
 *  - Hero stat: 이번달 환불 건수 / 환불액 / pending 건수
 *  - 탭 (전체 / pending / succeeded / failed)
 *  - 카드 list — 부분/전체 환불 / Toss transactionKey / 사유
 */
export default async function AdminRefundsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/refunds')
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  const [{ data: refunds }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('refunds')
      .select(
        'id, order_id, user_id, amount, reason, toss_transaction_key, refunded_at, refunded_by, status, order_item_ids, is_partial',
      )
      .order('refunded_at', { ascending: false })
      .limit(100),
    supabase
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  type Refund = {
    id: string
    order_id: string
    user_id: string
    amount: number
    reason: string | null
    toss_transaction_key: string | null
    refunded_at: string
    refunded_by: string | null
    status: 'pending' | 'succeeded' | 'failed'
    order_item_ids: string[] | null
    is_partial: boolean
  }
  const list = (refunds ?? []) as Refund[]

  // server component — 의도된 시간 의존성.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const monthStart = new Date(
    new Date(nowMs).getFullYear(),
    new Date(nowMs).getMonth(),
    1,
  ).getTime()

  let monthCount = 0
  let monthTotal = 0
  for (const r of list) {
    if (r.status !== 'succeeded') continue
    const t = new Date(r.refunded_at).getTime()
    if (t >= monthStart) {
      monthCount += 1
      monthTotal += r.amount
    }
  }

  return (
    <div className="px-5 py-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text font-semibold mb-3"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
            대시보드
          </Link>
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-terracotta" strokeWidth={2} />
            <h1 className="font-['Archivo_Black'] text-2xl text-ink">
              REFUNDS
            </h1>
          </div>
          <p className="text-[12px] text-muted mt-1">
            환불 audit log — Toss transactionKey 와 매핑
          </p>
        </div>
      </div>

      {/* Hero stat 3-grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          kicker="이번 달 환불"
          value={monthCount}
          unit="건"
          tone="terracotta"
          Icon={Calendar}
        />
        <StatCard
          kicker="이번 달 환불액"
          value={monthTotal}
          unit="원"
          tone="sale"
          Icon={TrendingDown}
        />
        <StatCard
          kicker="처리 대기"
          value={pendingCount ?? 0}
          unit="건"
          tone={pendingCount && pendingCount > 0 ? 'sale' : 'muted'}
          Icon={AlertTriangle}
          highlight={pendingCount && pendingCount > 0 ? true : false}
        />
      </div>

      {/* 환불 list */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">Recent100건</span>
        </div>
        {list.length === 0 ? (
          <div className="rounded-xl border border-rule px-5 py-12 text-center bg-white">
            <RefreshCcw
              className="w-10 h-10 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-text">
              아직 환불 내역이 없어요
            </p>
            <p className="text-[11px] text-muted mt-1">
              사용자가 self-service 또는 admin 부분취소 시 여기에 기록돼요
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <RefundRow key={r.id} refund={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({
  kicker,
  value,
  unit,
  tone,
  Icon,
  highlight,
}: {
  kicker: string
  value: number
  unit: string
  tone: 'terracotta' | 'sale' | 'muted' | 'moss'
  Icon: typeof RefreshCcw
  highlight?: boolean
}) {
  const colorMap = {
    terracotta: 'var(--terracotta)',
    sale: 'var(--sale)',
    muted: 'var(--muted)',
    moss: 'var(--moss)',
  }
  const accent = colorMap[tone]
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        background: highlight
          ? `color-mix(in srgb, ${accent} 6%, white)`
          : 'white',
        borderColor: highlight ? accent : 'var(--rule)',
      }}
    >
      <div className="flex items-center gap-1.5">
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
      <div className="mt-1 flex items-baseline gap-0.5">
        <span
          className="font-serif tabular-nums leading-none"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {value.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted">{unit}</span>
      </div>
    </div>
  )
}

function RefundRow({
  refund,
}: {
  refund: {
    id: string
    order_id: string
    amount: number
    reason: string | null
    toss_transaction_key: string | null
    refunded_at: string
    refunded_by: string | null
    status: 'pending' | 'succeeded' | 'failed'
    is_partial: boolean
  }
}) {
  const statusMeta = {
    pending: { label: 'Pending', Icon: Clock, color: 'var(--gold)' },
    succeeded: { label: 'Succeeded', Icon: Check, color: 'var(--moss)' },
    failed: { label: 'Failed', Icon: AlertTriangle, color: 'var(--sale)' },
  }[refund.status]
  const StatusIcon = statusMeta.Icon

  return (
    <li>
      <Link
        href={`/admin/orders/${refund.order_id}`}
        className="block bg-white rounded-xl border border-rule px-4 py-3 hover:border-text transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: `color-mix(in srgb, ${statusMeta.color} 12%, white)`,
              }}
            >
              <StatusIcon
                className="w-4 h-4"
                style={{ color: statusMeta.color }}
                strokeWidth={2}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="font-serif tabular-nums"
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--terracotta)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {refund.amount.toLocaleString()}원
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: refund.is_partial
                      ? 'color-mix(in srgb, var(--gold) 15%, white)'
                      : 'var(--bg-2)',
                    color: refund.is_partial ? 'var(--gold)' : 'var(--text)',
                  }}
                >
                  {refund.is_partial ? '부분' : '전체'}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: statusMeta.color,
                    border: `1px solid ${statusMeta.color}`,
                  }}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div className="text-[10.5px] text-muted mt-0.5 truncate">
                주문 #{refund.order_id.slice(0, 8)}
                {refund.reason && ` · ${refund.reason}`}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-muted font-mono tabular-nums">
              {formatDate(refund.refunded_at)}
            </div>
            {refund.refunded_by === null && (
              <div className="text-[9px] text-muted mt-0.5">self-service</div>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}
