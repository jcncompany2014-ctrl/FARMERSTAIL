import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * /admin/subscriptions/charges
 *
 * 정기배송 자동결제 시도 이력 모니터링. cron (subscription-charge) 가
 * 매일 새벽에 시도하는 결과를 한눈에 본다.
 *
 * # 핵심 요약 카드 (상단)
 *   - 오늘 시도 / 성공 / 실패 / 일시중단
 *   - 최근 30일 성공률
 *   - 누적 매출 (success 만)
 *
 * # 실패 큐 (가장 중요)
 *   - status='failed' 행을 최신순으로. 운영자가 사용자에게 카드 갱신
 *     안내 / 직접 컨택 등 follow-up 가능.
 *   - 같은 subscription 이 3회 누적 실패하면 자동 paused — 그 행은
 *     warning 톤으로 강조.
 *
 * # 전체 이력
 *   - status 필터 + 페이지네이션 (간단 form). 운영 초기엔 쿼리 스트링
 *     기반 페이징, 트래픽 늘면 cursor 로 전환.
 */

type ChargeRow = {
  id: string
  subscription_id: string
  user_id: string
  scheduled_for: string
  status: 'pending' | 'succeeded' | 'failed' | 'skipped'
  payment_key: string | null
  order_id: string | null
  amount: number
  error_code: string | null
  error_message: string | null
  attempted_at: string
  completed_at: string | null
}

const STATUS_CONFIG: Record<
  ChargeRow['status'],
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: '진행', color: 'var(--gold)', icon: Clock },
  succeeded: { label: '성공', color: 'var(--moss)', icon: CheckCircle2 },
  failed: { label: '실패', color: 'var(--sale)', icon: AlertTriangle },
  skipped: { label: '건너뜀', color: 'var(--muted)', icon: X },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}.${day} ${hh}:${mm}`
}

function todayKstIsoDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default async function SubscriptionChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const status = sp.status as ChargeRow['status'] | undefined
  const pageNum = Math.max(1, Number(sp.page ?? '1') || 1)
  const PAGE_SIZE = 50

  // 최근 30일 집계
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const today = todayKstIsoDate()

  const [todayRes, last30dRes, listRes] = await Promise.all([
    // 오늘 시도들
    supabase
      .from('subscription_charges')
      .select('status, amount')
      .eq('scheduled_for', today),
    // 30일 시도들 (성공률 + 누적 매출용)
    supabase
      .from('subscription_charges')
      .select('status, amount')
      .gte('attempted_at', thirtyDaysAgo),
    // 리스트 — 필터 적용
    (status
      ? supabase
          .from('subscription_charges')
          .select('*')
          .eq('status', status)
      : supabase.from('subscription_charges').select('*')
    )
      .order('attempted_at', { ascending: false })
      .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1),
  ])

  type AggRow = { status: ChargeRow['status']; amount: number }
  const todayRows = (todayRes.data ?? []) as AggRow[]
  const last30dRows = (last30dRes.data ?? []) as AggRow[]
  const list = (listRes.data ?? []) as ChargeRow[]

  const todayCounts = {
    total: todayRows.length,
    succeeded: todayRows.filter((r) => r.status === 'succeeded').length,
    failed: todayRows.filter((r) => r.status === 'failed').length,
    pending: todayRows.filter((r) => r.status === 'pending').length,
  }

  const last30dSuccess = last30dRows.filter((r) => r.status === 'succeeded')
  const last30dFailed = last30dRows.filter((r) => r.status === 'failed')
  const successRate =
    last30dSuccess.length + last30dFailed.length === 0
      ? 100
      : (last30dSuccess.length /
          (last30dSuccess.length + last30dFailed.length)) *
        100
  const last30dRevenue = last30dSuccess.reduce((s, r) => s + r.amount, 0)

  const filterLink = (s: ChargeRow['status'] | undefined): string => {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    const qs = params.toString()
    return qs
      ? `/admin/subscriptions/charges?${qs}`
      : '/admin/subscriptions/charges'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Archivo_Black'] text-2xl text-ink">
          SUBSCRIPTION CHARGES
        </h1>
        <p className="text-sm text-muted mt-1">정기배송 자동결제 이력</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="오늘 시도"
          value={`${todayCounts.total}건`}
          sub={`성공 ${todayCounts.succeeded} · 실패 ${todayCounts.failed}`}
        />
        <SummaryCard
          label="30일 성공률"
          value={`${successRate.toFixed(1)}%`}
          sub={`${last30dSuccess.length} / ${
            last30dSuccess.length + last30dFailed.length
          }건`}
          tone={successRate >= 95 ? 'moss' : successRate >= 85 ? 'gold' : 'sale'}
        />
        <SummaryCard
          label="30일 누적 매출"
          value={`${last30dRevenue.toLocaleString()}원`}
          sub="success 만 합산"
        />
        <SummaryCard
          label="30일 실패"
          value={`${last30dFailed.length}건`}
          sub="follow-up 필요"
          tone={last30dFailed.length > 0 ? 'sale' : 'moss'}
        />
      </div>

      {/* 필터 칩 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <FilterChip href={filterLink(undefined)} active={!status} label="전체" />
        <FilterChip
          href={filterLink('failed')}
          active={status === 'failed'}
          label="실패"
        />
        <FilterChip
          href={filterLink('pending')}
          active={status === 'pending'}
          label="진행"
        />
        <FilterChip
          href={filterLink('succeeded')}
          active={status === 'succeeded'}
          label="성공"
        />
        <FilterChip
          href={filterLink('skipped')}
          active={status === 'skipped'}
          label="건너뜀"
        />
      </div>

      {/* 리스트 */}
      <div className="bg-white rounded-xl border border-rule overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-bg-2 text-muted text-[11px] uppercase tracking-widest">
            <tr>
              <th className="text-left px-4 py-2.5 font-bold">시도일</th>
              <th className="text-left px-4 py-2.5 font-bold">상태</th>
              <th className="text-right px-4 py-2.5 font-bold">금액</th>
              <th className="text-left px-4 py-2.5 font-bold">예정일</th>
              <th className="text-left px-4 py-2.5 font-bold">에러</th>
              <th className="text-left px-4 py-2.5 font-bold">주문</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted">
                  결과가 없어요
                </td>
              </tr>
            ) : (
              list.map((row) => {
                const c = STATUS_CONFIG[row.status]
                const Icon = c.icon
                return (
                  <tr
                    key={row.id}
                    className="border-t border-rule hover:bg-bg/40"
                  >
                    <td className="px-4 py-3 text-text">
                      {formatDateTime(row.attempted_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold"
                        style={{ background: c.color, color: 'white' }}
                      >
                        <Icon className="w-3 h-3" strokeWidth={2.5} />
                        {c.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-muted">{row.scheduled_for}</td>
                    <td className="px-4 py-3 text-[11.5px] text-muted">
                      {row.error_code && (
                        <span className="font-mono mr-1.5">
                          {row.error_code}
                        </span>
                      )}
                      <span className="line-clamp-1">{row.error_message}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.order_id ? (
                        <Link
                          href={`/admin/orders/${row.order_id}`}
                          className="text-terracotta hover:underline text-[12px]"
                        >
                          주문 보기 →
                        </Link>
                      ) : (
                        <span className="text-muted/60">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 — 단순 prev/next */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11.5px] text-muted">
          페이지 {pageNum} · {list.length}건 표시 · 페이지당 {PAGE_SIZE}건
        </p>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link
              href={`${filterLink(status)}${
                filterLink(status).includes('?') ? '&' : '?'
              }page=${pageNum - 1}`}
              className="px-3 py-1.5 rounded-lg border border-rule text-[12px] font-bold hover:border-terracotta hover:text-terracotta transition"
            >
              ← 이전
            </Link>
          )}
          {list.length === PAGE_SIZE && (
            <Link
              href={`${filterLink(status)}${
                filterLink(status).includes('?') ? '&' : '?'
              }page=${pageNum + 1}`}
              className="px-3 py-1.5 rounded-lg border border-rule text-[12px] font-bold hover:border-terracotta hover:text-terracotta transition"
            >
              다음 →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'moss' | 'gold' | 'sale'
}) {
  const color =
    tone === 'moss'
      ? 'var(--moss)'
      : tone === 'gold'
        ? 'var(--gold)'
        : tone === 'sale'
          ? 'var(--sale)'
          : 'var(--ink)'
  return (
    <div className="bg-white rounded-xl border border-rule p-4">
      <p className="text-[10.5px] font-bold text-muted uppercase tracking-widest">
        {label}
      </p>
      <p
        className="font-serif text-[22px] font-black mt-1.5 tabular-nums"
        style={{ color, letterSpacing: '-0.02em', lineHeight: 1.1 }}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted mt-1">{sub}</p>
    </div>
  )
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      className={
        'shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition ' +
        (active
          ? 'bg-ink text-white'
          : 'bg-white text-text border border-rule hover:border-text')
      }
    >
      {label}
    </Link>
  )
}
