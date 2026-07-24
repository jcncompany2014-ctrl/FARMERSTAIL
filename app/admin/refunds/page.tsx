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
import { todayKstIsoDate } from '@/lib/datetime-kst'

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

  // 데드레터 — 자동 재시도 모두 실패한 환불(수동 처리 필요). payment_refund_queue
  // 는 supabase typegen 미포함이라 unknown 캐스팅. RLS admin read 정책(마이그
  // 20260608000002) 적용 후 노출 — 미적용/RLS 차단이면 빈 배열(무해).
  const { data: deadLetters } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => { limit: (n: number) => Promise<{ data: unknown }> }
        }
      }
    }
  )
    .from('payment_refund_queue')
    .select('id, order_id, amount, attempts, reason, last_error')
    .eq('status', 'permanently_failed')
    .limit(20)
  const dead = ((deadLetters as unknown[]) ?? []) as Array<{
    id: string
    order_id: string
    amount: number
    attempts: number
    reason: string | null
    last_error: string | null
  }>

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

  // 이번 달(KST) 시작 instant — Vercel UTC 환경에서 월 경계 off-by-one 방지.
  // 이전엔 UTC 월초라 KST 월초 첫 9시간 환불이 전월로 빠졌다.
  const monthStart = new Date(
    `${todayKstIsoDate().slice(0, 7)}-01T00:00:00+09:00`,
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
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
              환불 관리
            </h1>
          </div>
          <p className="text-[13px] text-zinc-500 mt-1">
            지금까지 처리한 환불 내역을 보는 곳이에요. 각 건은 토스 거래번호와
            연결돼 있어요. 환불 자체는 주문 상세에서 처리해요.
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

      {/* 데드레터 — 자동 재시도 모두 실패(수동 처리 필요). 최우선 노출. */}
      {dead.length > 0 && (
        <section className="mb-6 rounded-xl border-2 border-sale/40 bg-sale/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-sale" strokeWidth={2.4} />
            <h2 className="text-[13px] font-bold text-sale">
              환불 영구 실패 — 수동 처리 필요 ({dead.length})
            </h2>
          </div>
          <ul className="space-y-1.5">
            {dead.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2"
              >
                <Link
                  href={`/admin/orders/${d.order_id}`}
                  className="font-mono text-[12px] text-text hover:text-terracotta truncate"
                >
                  주문 #{String(d.order_id).slice(0, 8)} ·{' '}
                  {Number(d.amount).toLocaleString()}원
                </Link>
                <span className="text-[10px] text-muted shrink-0">
                  {d.attempts}회 실패
                  {d.last_error ? ` · ${String(d.last_error).slice(0, 28)}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] text-muted mt-2 leading-relaxed">
            자동 재시도가 모두 실패했어요. Toss 콘솔에서 직접 환불 후 해당 주문을
            처리해 주세요. (이 목록은 비어 있는 게 정상이에요)
          </p>
        </section>
      )}

      {/* 환불 list */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">최근 100건</span>
        </div>
        {list.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 px-5 py-12 text-center bg-white">
            <RefreshCcw
              className="w-10 h-10 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-text">
              아직 환불 내역이 없어요
            </p>
            <p className="text-[11px] text-muted mt-1">
              고객이 직접 환불하거나 관리자가 부분취소하면 여기에 기록돼요
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
          className="font-sans tabular-nums leading-none"
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
    pending: { label: '대기', Icon: Clock, color: 'var(--gold)' },
    succeeded: { label: '완료', Icon: Check, color: 'var(--moss)' },
    failed: { label: '실패', Icon: AlertTriangle, color: 'var(--sale)' },
  }[refund.status]
  const StatusIcon = statusMeta.Icon

  return (
    <li>
      <Link
        href={`/admin/orders/${refund.order_id}`}
        className="block bg-white rounded-xl border border-zinc-200 px-4 py-3 hover:border-text transition"
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
                  className="font-sans tabular-nums"
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
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
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
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
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
              <div className="text-[9px] text-muted mt-0.5">고객 직접 환불</div>
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
