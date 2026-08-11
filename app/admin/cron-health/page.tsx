import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { AdminTabs, StatCard, Hl, Em, Warn, LoadError } from '@/components/admin/ui'
import { SETTINGS_TABS } from '@/components/admin/tabGroups'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { cronLabel } from '@/lib/cron-labels'
import { findMissedCrons, type CronEntry } from '@/lib/cron-watchdog'
import vercelConfig from '@/vercel.json'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '자동작업 상태 — Admin',
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
  const user = await getRequestUser()
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
  const { data: rowsData, error: rowsError } = await supabase
    .from('cron_health')
    .select('id, path, status, duration_ms, error_message, executed_at')
    .gte('executed_at', windowStart)
    .order('executed_at', { ascending: false })
    .limit(1000)

  // ★조회 실패를 '실행 0건' 으로 읽으면 성공률이 100% 로 표시된다 —
  //  자동작업이 전부 죽어 있어도 화면은 초록이다(AGENTS.md 규칙1·8).
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
  /**
   * ★"돌았어야 하는데 기록이 없는" 크론 (2026-08-08 크론 감사).
   *
   * 이 화면은 여태 **행이 있는 것만** 그렸다. 그런데 크론이 죽는 가장 흔한
   * 방식은 실패가 아니라 **아예 안 도는 것**이다:
   *  · CRON_SECRET 이 없으면 29개가 전부 401 인데, 401 은 trackCron 진입
   *    **전**이라 cron_health 에 행이 아예 안 생긴다 → 화면에서 그냥 사라진다
   *  · Vercel 크론 요금 한도로 배포가 거부돼도 마찬가지
   *
   * 유일한 감지기였던 워치독은 daily-briefing **안**에서만 돌았다 — 그것도
   * 크론이라 같이 죽고, 결과는 관리자 푸시로만 나갔다. 여기서 한 번 더 본다.
   * 이 화면은 크론이 아니라 사장님이 여는 페이지라 크론이 전부 죽어도 뜬다.
   */
  const missedCrons = (() => {
    try {
      const endUtc = new Date(nowMs - 60 * 60 * 1000) // 마지막 1시간은 유예
      const startUtc = new Date(nowMs - 25 * 60 * 60 * 1000)
      return findMissedCrons(
        (vercelConfig as { crons: CronEntry[] }).crons,
        rows.map((r) => ({ path: r.path, executed_at: r.executed_at })),
        startUtc,
        endUtc,
      )
    } catch {
      // 워치독이 못 돌아도 이 화면 자체는 떠야 한다.
      return []
    }
  })()

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
      {!rowsError && missedCrons.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sale text-sm font-bold">
            안 돈 자동작업 {missedCrons.length}건 — 어제 이 시각 이후 기록이 없어요
          </p>
          <p className="text-xs text-zinc-700 mt-1.5 leading-relaxed">
            실패한 게 아니라 <strong>아예 실행되지 않았다</strong>는 뜻이에요.
            결제·발송·알림이 멈춰 있을 수 있어요. 가장 흔한 원인은 Vercel 환경변수
            <code className="mx-1 px-1 bg-white rounded">CRON_SECRET</code>
            누락(전부 401)과 크론 요금 한도로 인한 배포 거부예요.
          </p>
          <p className="text-[11px] text-zinc-600 mt-2 font-mono break-all">
            {missedCrons.join(' · ')}
          </p>
        </div>
      )}
      {rowsError && (
        <div className="mb-4">
          <LoadError
            what="자동작업 기록"
            hint="아래 성공률·목록은 믿을 수 없어요. 조회가 실패한 것이지 작업이 안 돈 게 아닙니다."
          />
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
          자동작업 상태
        </h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          <Hl>뒤에서 자동으로 도는 작업들이 잘 돌아갔는지</Hl> 보는 곳이에요
          (결제·배송·알림). <Warn>빨간 게 있으면 뭔가 멈춘 것</Warn>이라 확인이
          필요해요 (최근 <Em>{WINDOW_DAYS}일</Em>).
        </p>
      </div>

      {/* Hero stat 3-grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {/* ★조회가 실패했으면 숫자를 말하지 않는다 (2026-08-07).
            배너만 얹고 "성공률 100% · 실패 없음" 을 초록으로 두면, 한 화면이
            동시에 "못 불러왔어요"와 "정상"을 말한다 — 눈에 먼저 들어오는 건
            큰 초록 숫자다. 모르면 모른다고 한다. */}
        <StatCard
          label={`${WINDOW_DAYS}일 총 실행`}
          value={rowsError ? '—' : rows.length.toLocaleString()}
          unit={rowsError ? undefined : '건'}
          sub={
            rowsError
              ? '조회 실패'
              : `성공 ${successCount.toLocaleString()} · 실패 ${errorRows.length.toLocaleString()}`
          }
          tone={rowsError ? 'amber' : 'neutral'}
        />
        <StatCard
          label={`${WINDOW_DAYS}일 실패`}
          value={rowsError ? '—' : errorRows.length.toLocaleString()}
          unit={rowsError ? undefined : '건'}
          sub={
            rowsError
              ? '알 수 없음'
              : errorRows.length > 0
                ? '원인 확인 필요'
                : '실패 없음'
          }
          tone={rowsError ? 'amber' : errorRows.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="성공률"
          value={rowsError ? '—' : `${successRate.toFixed(1)}%`}
          sub={
            rowsError
              ? '조회가 실패해 계산할 수 없어요'
              : `${successCount.toLocaleString()} / ${rows.length.toLocaleString()}건`
          }
          tone={
            rowsError
              ? 'amber'
              : successRate >= 99
                ? 'green'
                : successRate >= 90
                  ? 'amber'
                  : 'red'
          }
        />
      </div>

      {/* 실패 큐 — 가장 중요. status='error' 행 최신순. */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">실패 기록 · 최근 {WINDOW_DAYS}일</span>
        </div>
        {rowsError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
            <p className="text-[13px] font-bold text-amber-900">
              기록을 못 불러와서 실패가 있었는지 알 수 없어요
            </p>
            <p className="text-[11px] text-amber-800 mt-1">
              실패가 없는 것과 다릅니다. 새로고침해 주세요.
            </p>
          </div>
        ) : errorRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 px-5 py-12 text-center bg-white">
            <CheckCircle2
              className="w-10 h-10 text-moss mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-zinc-800">
              최근 {WINDOW_DAYS}일 자동작업 실패 없음 — 정상
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              자동작업이 실패하면 작업·오류 메시지·시각이 여기에 기록돼요
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50 text-zinc-500 text-[11px]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">실행 시각</th>
                  <th className="text-left px-4 py-2.5 font-bold">자동작업</th>
                  <th className="text-right px-4 py-2.5 font-bold">소요</th>
                  <th className="text-left px-4 py-2.5 font-bold">무슨 문제였나</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-200 hover:bg-zinc-50/40 align-top"
                  >
                    <td className="px-4 py-3 text-zinc-800 whitespace-nowrap tabular-nums">
                      {formatKst(row.executed_at)}
                    </td>
                    {/* 경로(/api/cron/…) 대신 한국어 이름. 라벨 미등록이면
                        cronLabel 이 원본을 돌려주므로 빠진 게 눈에 띈다. */}
                    <td className="px-4 py-3">
                      <span className="text-[12.5px] font-semibold text-zinc-800 break-keep">
                        {cronLabel(row.path)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 font-mono tabular-nums whitespace-nowrap">
                      {formatDuration(row.duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-sale break-words">
                      {row.error_message ?? (
                        <span className="text-zinc-500">(메시지 없음)</span>
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
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">자동작업별 요약 · 최근 {WINDOW_DAYS}일</span>
        </div>
        {summaries.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 px-5 py-12 text-center bg-white">
            <Clock
              className="w-10 h-10 text-zinc-500 mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[13px] font-bold text-zinc-800">
              최근 {WINDOW_DAYS}일 자동작업 실행 기록이 없어요
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              자동작업이 돌기 시작하면 여기에 요약이 쌓여요
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50 text-zinc-500 text-[11px]">
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
                      className="border-t border-zinc-200 hover:bg-zinc-50/40"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] font-semibold text-zinc-800 break-keep">
                          {cronLabel(s.path)}
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
                      <td className="px-4 py-3 text-right text-zinc-500 font-mono tabular-nums">
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
                      <td className="px-4 py-3 text-right text-[11px] text-zinc-500 font-mono tabular-nums whitespace-nowrap">
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
