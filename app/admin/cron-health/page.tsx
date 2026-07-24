import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { AdminTabs } from '@/components/admin/ui'
import { SETTINGS_TABS } from '@/components/admin/tabGroups'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cron 헬스 — Admin',
  robots: { index: false, follow: false },
}

/**
 * /admin/cron-health — cron 실행 audit log 한 화면.
 *
 * 대시보드 "24h cron 실패" 카드(ActionsPanel)가 가리키는 목적지. 어떤 cron 이
 * 왜 실패했는지(path · error_message · 시각 · duration) 한눈에 보고, cron 별
 * 최근 실행 성공/실패 요약을 본다. cron_health 테이블
 * (마이그레이션 20260507000002) 데이터를 조회.
 *
 * # 표시
 *  - Hero stat: 7일 총 실행 / 실패 / 성공률
 *  - 실패 큐 (가장 중요): 최근 7일 status='error' 행 최신순
 *  - cron 별 요약: path 별 성공/실패 카운트 + 마지막 실행 결과
 *
 * # 가드
 *  admin layout 이 이미 isAdmin redirect 하지만, sibling 페이지(refunds/charges)
 *  와 일관되게 페이지 레벨에서도 한 번 더 가드.
 */

type CronRow = {
  id: string
  path: string
  status: string
  duration_ms: number | null
  error_message: string | null
  executed_at: string
}

const WINDOW_DAYS = 7

function formatKst(iso: string): string {
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

function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`
}

export default async function AdminCronHealthPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/cron-health')
  if (!(await isAdmin(supabase, user))) redirect('/admin')

  // server component (async) — 매 요청 한 번만 실행. React 19 purity 룰의
  // client 가정이 적용되지 않으나, charges 페이지와 동일하게 그 라인에만 disable.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const windowStart = new Date(
    nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  // 한 번의 조회로 최근 7일 전체 행을 가져와 클라이언트 측 집계.
  // cron 은 하루 수십 건 수준이라 7일 ≈ 수백 행 — 메모리 집계가 충분히 저렴.
  const { data: rowsData } = await supabase
    .from('cron_health')
    .select('id, path, status, duration_ms, error_message, executed_at')
    .gte('executed_at', windowStart)
    .order('executed_at', { ascending: false })
    .limit(1000)

  const rows = (rowsData ?? []) as CronRow[]

  const errorRows = rows.filter((r) => r.status === 'error')
  const successCount = rows.length - errorRows.length
  const successRate =
    rows.length === 0 ? 100 : (successCount / rows.length) * 100

  // cron(path) 별 요약 — 성공/실패 카운트 + 마지막 실행(가장 최근) 상태.
  // rows 가 이미 executed_at desc 라 path 별 첫 등장이 곧 마지막 실행.
  type CronSummary = {
    path: string
    total: number
    success: number
    error: number
    lastStatus: string
    lastAt: string
  }
  const summaryMap = new Map<string, CronSummary>()
  for (const r of rows) {
    const prev = summaryMap.get(r.path)
    if (prev) {
      prev.total += 1
      if (r.status === 'error') prev.error += 1
      else prev.success += 1
    } else {
      summaryMap.set(r.path, {
        path: r.path,
        total: 1,
        success: r.status === 'error' ? 0 : 1,
        error: r.status === 'error' ? 1 : 0,
        lastStatus: r.status,
        lastAt: r.executed_at,
      })
    }
  }
  // 실패가 있는 cron 을 위로, 그다음 path 알파벳순.
  const summaries = Array.from(summaryMap.values()).sort((a, b) => {
    if ((b.error > 0 ? 1 : 0) !== (a.error > 0 ? 1 : 0)) {
      return (b.error > 0 ? 1 : 0) - (a.error > 0 ? 1 : 0)
    }
    return a.path.localeCompare(b.path)
  })

  return (
    <div>
      {/* 대개편 v2 T6 — 설정 그룹 탭 (뒤로가기 링크 대체·헤더 zinc 통일) */}
      <AdminTabs tabs={SETTINGS_TABS} active="/admin/cron-health" />
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
          자동작업 상태
        </h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          결제·배송·알림처럼 뒤에서 자동으로 도는 작업들이 잘 돌아갔는지 보는
          곳이에요. 빨간 게 있으면 뭔가 멈춘 거라 확인이 필요해요 (최근{' '}
          {WINDOW_DAYS}일).
        </p>
      </div>

      {/* Hero stat 3-grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          label={`${WINDOW_DAYS}일 총 실행`}
          value={`${rows.length.toLocaleString()}건`}
          sub={`성공 ${successCount.toLocaleString()} · 실패 ${errorRows.length.toLocaleString()}`}
        />
        <SummaryCard
          label={`${WINDOW_DAYS}일 실패`}
          value={`${errorRows.length.toLocaleString()}건`}
          sub={errorRows.length > 0 ? '원인 확인 필요' : '실패 없음'}
          tone={errorRows.length > 0 ? 'sale' : 'moss'}
        />
        <SummaryCard
          label="성공률"
          value={`${successRate.toFixed(1)}%`}
          sub={`${successCount.toLocaleString()} / ${rows.length.toLocaleString()}건`}
          tone={
            successRate >= 99 ? 'moss' : successRate >= 90 ? 'gold' : 'sale'
          }
        />
      </div>

      {/* 실패 큐 — 가장 중요. status='error' 행 최신순. */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">실패 기록 · 최근 {WINDOW_DAYS}일</span>
        </div>
        {errorRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 px-5 py-12 text-center bg-white">
            <CheckCircle2
              className="w-10 h-10 text-moss mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-text">
              최근 {WINDOW_DAYS}일 자동작업 실패 없음 — 정상
            </p>
            <p className="text-[11px] text-muted mt-1">
              자동작업이 실패하면 작업·오류 메시지·시각이 여기에 기록돼요
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2 text-muted text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">실행 시각</th>
                  <th className="text-left px-4 py-2.5 font-bold">자동작업</th>
                  <th className="text-right px-4 py-2.5 font-bold">소요</th>
                  <th className="text-left px-4 py-2.5 font-bold">에러 메시지</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-200 hover:bg-bg/40 align-top"
                  >
                    <td className="px-4 py-3 text-text whitespace-nowrap tabular-nums">
                      {formatKst(row.executed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11.5px] text-text break-all">
                        {row.path}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted font-mono tabular-nums whitespace-nowrap">
                      {formatDuration(row.duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-sale break-words">
                      {row.error_message ?? (
                        <span className="text-muted">(메시지 없음)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* cron 별 요약 — path 별 성공/실패 + 마지막 실행 결과. */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">Cron 별 요약 · 최근 {WINDOW_DAYS}일</span>
        </div>
        {summaries.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 px-5 py-12 text-center bg-white">
            <Clock
              className="w-10 h-10 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-text">
              최근 {WINDOW_DAYS}일 cron 실행 기록이 없어요
            </p>
            <p className="text-[11px] text-muted mt-1">
              cron 이 실행되면 cron_health 에 기록돼 여기에 요약돼요
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2 text-muted text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">자동작업</th>
                  <th className="text-center px-4 py-2.5 font-bold">마지막</th>
                  <th className="text-right px-4 py-2.5 font-bold">실행</th>
                  <th className="text-right px-4 py-2.5 font-bold">성공</th>
                  <th className="text-right px-4 py-2.5 font-bold">실패</th>
                  <th className="text-right px-4 py-2.5 font-bold">최근 실행</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const lastOk = s.lastStatus !== 'error'
                  return (
                    <tr
                      key={s.path}
                      className="border-t border-zinc-200 hover:bg-bg/40"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11.5px] text-text break-all">
                          {s.path}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                          style={{
                            background: lastOk
                              ? 'var(--moss)'
                              : 'var(--sale)',
                            color: 'white',
                          }}
                        >
                          {lastOk ? (
                            <CheckCircle2
                              className="w-3 h-3"
                              strokeWidth={2.5}
                            />
                          ) : (
                            <AlertTriangle
                              className="w-3 h-3"
                              strokeWidth={2.5}
                            />
                          )}
                          {lastOk ? '성공' : '실패'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted font-mono tabular-nums">
                        {s.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-moss font-mono tabular-nums">
                        {s.success.toLocaleString()}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono tabular-nums"
                        style={{
                          color: s.error > 0 ? 'var(--sale)' : 'var(--muted)',
                        }}
                      >
                        {s.error.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-muted font-mono tabular-nums whitespace-nowrap">
                        {formatKst(s.lastAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
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
