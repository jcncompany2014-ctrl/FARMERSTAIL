import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { redirect } from 'next/navigation'
import {
  RefreshCcw,
  Calendar,
  TrendingDown,
  AlertTriangle,
  Check,
  Clock,
} from 'lucide-react'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { Hl, Em } from '@/components/admin/ui'
import { Badge } from '@/components/adminui/badge'
import { Card, CardContent } from '@/components/adminui/card'

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
  const user = await getRequestUser()
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
    <div className="grid gap-4">
      <div>
        <div className="flex items-center gap-2">
          <RefreshCcw className="size-5 text-primary" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">환불 관리</h1>
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          <Hl>지금까지 처리한 환불 내역</Hl>을 보는 곳이에요. 각 건은 토스
          거래번호와 연결돼 있어요. <Em>환불 자체는 주문 상세에서 처리</Em>해요.
        </p>
      </div>

      {/* Hero stat 3-grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard kicker="이번 달 환불" value={monthCount} unit="건" tone="brand" Icon={Calendar} />
        <StatCard kicker="이번 달 환불액" value={monthTotal} unit="원" tone="danger" Icon={TrendingDown} />
        <StatCard
          kicker="처리 대기"
          value={pendingCount ?? 0}
          unit="건"
          tone={pendingCount && pendingCount > 0 ? 'danger' : 'muted'}
          Icon={AlertTriangle}
          highlight={pendingCount && pendingCount > 0 ? true : false}
        />
      </div>

      {/* 데드레터 — 자동 재시도 모두 실패(수동 처리 필요). 최우선 노출. */}
      {dead.length > 0 && (
        <Card className="gap-3 border-destructive/40 bg-destructive/5 py-4">
          <CardContent className="px-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" strokeWidth={2.4} />
              <h2 className="text-[13px] font-bold text-destructive">
                환불 영구 실패 — 수동 처리 필요 ({dead.length})
              </h2>
            </div>
            <ul className="space-y-1.5">
              {dead.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2"
                >
                  <Link
                    href={`/admin/orders/${d.order_id}`}
                    className="truncate font-mono text-[12px] hover:text-primary"
                  >
                    주문 #{String(d.order_id).slice(0, 8)} ·{' '}
                    {Number(d.amount).toLocaleString()}원
                  </Link>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {d.attempts}회 실패
                    {d.last_error ? ` · ${String(d.last_error).slice(0, 28)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              자동 재시도가 모두 실패했어요. Toss 콘솔에서 직접 환불 후 해당 주문을
              처리해 주세요. (이 목록은 비어 있는 게 정상이에요)
            </p>
          </CardContent>
        </Card>
      )}

      {/* 환불 list */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            최근 100건
          </span>
        </div>
        {list.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <RefreshCcw className="mx-auto mb-3 size-10 text-muted-foreground" strokeWidth={1.3} />
              <p className="text-[13px] font-bold">아직 환불 내역이 없어요</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                고객이 직접 환불하거나 관리자가 부분취소하면 여기에 기록돼요
              </p>
            </CardContent>
          </Card>
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
  tone: 'brand' | 'danger' | 'muted'
  Icon: typeof RefreshCcw
  highlight?: boolean
}) {
  const accentCls = {
    brand: 'text-primary',
    danger: 'text-destructive',
    muted: 'text-muted-foreground',
  }[tone]
  return (
    <Card
      className={`gap-1 py-3.5 ${highlight ? 'border-destructive/50 bg-destructive/5' : ''}`}
    >
      <CardContent className="px-4">
        <div className={`flex items-center gap-1.5 ${accentCls}`}>
          <Icon className="size-3" strokeWidth={2.5} />
          <span className="text-[10.5px] font-bold">{kicker}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-0.5">
          <span className="text-xl font-extrabold leading-none tracking-tight tabular-nums md:text-2xl">
            {value.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">{unit}</span>
        </div>
      </CardContent>
    </Card>
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
    pending: { label: '대기', Icon: Clock, iconCls: 'bg-amber-100 text-amber-700', badgeCls: 'bg-amber-100 text-amber-900 border-transparent' },
    succeeded: { label: '완료', Icon: Check, iconCls: 'bg-emerald-100 text-emerald-700', badgeCls: 'bg-emerald-100 text-emerald-900 border-transparent' },
    failed: { label: '실패', Icon: AlertTriangle, iconCls: 'bg-red-100 text-red-700', badgeCls: 'bg-destructive text-white border-transparent' },
  }[refund.status]
  const StatusIcon = statusMeta.Icon

  return (
    <li>
      <Link href={`/admin/orders/${refund.order_id}`} className="block">
        <Card className="gap-0 py-3 transition hover:border-ring">
          <CardContent className="px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${statusMeta.iconCls}`}>
                  <StatusIcon className="size-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold tracking-tight text-primary tabular-nums">
                      {refund.amount.toLocaleString()}원
                    </span>
                    <Badge variant={refund.is_partial ? 'outline' : 'secondary'} className={refund.is_partial ? 'border-amber-300 text-amber-800' : ''}>
                      {refund.is_partial ? '부분' : '전체'}
                    </Badge>
                    <Badge className={statusMeta.badgeCls}>{statusMeta.label}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                    주문 #{refund.order_id.slice(0, 8)}
                    {refund.reason && ` · ${refund.reason}`}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {formatDate(refund.refunded_at)}
                </div>
                {refund.refunded_by === null && (
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">고객 직접 환불</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
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
