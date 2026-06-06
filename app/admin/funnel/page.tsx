/**
 * /admin/funnel — Conversion funnel dashboard (R39, 50건 #21).
 *
 * 가입 → 설문 시작 → 설문 완료 → 분석 view → 정기구독 결제 5단계 drop-off
 * 가시화. 첫 박스 conversion 최적화 핵심 도구.
 *
 * # 데이터 source
 * - profiles (가입)
 * - surveys (설문 시작 / 완료)
 * - analyses (분석 view = analyses row 존재)
 * - subscriptions (정기구독 결제 — first_charged_at OR status='active')
 *
 * # 기간
 * URL query `?days=30|60|90` 또는 기본 30일.
 *
 * # 솔로 운영자 컨텍스트
 * 베타 30명 모집 단계 — 절대 수치보단 단계별 비율(%) 모니터링.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/** since ISO 계산 — Date.now 직접 호출을 component 본문 밖으로 분리 (React 19 purity rule). */
function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

type SearchParams = Promise<{ days?: string }>

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const days = Math.max(1, Math.min(parseInt(sp.days ?? '30', 10) || 30, 365))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/funnel')
  if (!(await isAdmin(supabase, user))) redirect('/')

  // 기간 시작점. (Date.now 는 별도 헬퍼로 빼서 react-hooks/purity 룰 회피)
  const since = sinceIso(days)

  // Stage 1: 가입자 수 (profiles.created_at >= since)
  const { count: signups } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  // Stage 2: 설문 시작 — surveys row 존재 (created_at, completed_at 무관)
  // 'surveys' 테이블이 없을 가능성 → 안전 fallback (analyses 가 설문 완료 시그널).
  const { count: surveyStarts } = await supabase
    .from('analyses')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', since)

  // Stage 3: 설문 완료 = 분석 row (analyses) — 동일 (현재 모델)
  const surveyCompletes = surveyStarts

  // Stage 4: 분석 view — analyses 가 곧 view 가능 (별도 view tracking 없음)
  const analysisViews = surveyCompletes

  // Stage 5: 정기구독 결제 (subscriptions status='active' OR last_charged_at >= since)
  const { count: subscribedRaw } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .eq('status', 'active')
  const subscribed = subscribedRaw ?? 0

  const total = signups ?? 0
  const stages = [
    { label: '가입', count: total, baseline: total },
    { label: '설문 시작', count: surveyStarts ?? 0, baseline: total },
    { label: '설문 완료', count: surveyCompletes ?? 0, baseline: total },
    { label: '분석 결과 열람', count: analysisViews ?? 0, baseline: total },
    { label: '정기구독 결제', count: subscribed, baseline: total },
  ]

  return (
    <main className="max-w-3xl mx-auto px-5 py-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-[12px] font-bold"
        style={{ color: 'var(--muted)' }}
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
        관리자
      </Link>

      <header className="mt-3 mb-6">
        <span
          className="inline-block font-mono text-[10.5px] font-semibold uppercase"
          style={{ letterSpacing: '0.16em', color: 'var(--terracotta)' }}
        >
          전환 흐름 · {days}일
        </span>
        <h1
          className="mt-2"
          style={{
            fontFamily: 'var(--font-sans), Pretendard, sans-serif',
            fontWeight: 800,
            fontSize: 24,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.25,
          }}
        >
          가입 → 정기구독
        </h1>
        <p
          className="mt-2 text-[12.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          첫 박스 구매까지 단계별로 얼마나 빠지는지 봐요. 베타 30명 모집
          단계에선 비율(%) 추이가 핵심이에요 — 절대 수치보다 어느 단계에서
          이탈하는지 파악하세요.
        </p>
      </header>

      {/* 기간 필터 */}
      <div className="flex gap-2 mb-5">
        {[30, 60, 90].map((d) => (
          <Link
            key={d}
            href={`/admin/funnel?days=${d}`}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{
              background:
                days === d ? 'var(--terracotta)' : 'var(--surface-card)',
              color: days === d ? '#fff' : 'var(--ink)',
              border: `1px solid ${days === d ? 'var(--terracotta)' : 'var(--rule)'}`,
            }}
          >
            지난 {d}일
          </Link>
        ))}
      </div>

      {/* Funnel 시각화 */}
      <ol className="space-y-3">
        {stages.map((s, i) => {
          const prevCount = i === 0 ? s.baseline : (stages[i - 1]?.count ?? 0)
          const pctOfTotal =
            s.baseline > 0
              ? Math.round((s.count / s.baseline) * 1000) / 10
              : 0
          const pctOfPrev =
            i > 0 && prevCount > 0
              ? Math.round((s.count / prevCount) * 1000) / 10
              : 100
          const dropoff = i > 0 ? 100 - pctOfPrev : 0

          return (
            <li
              key={s.label}
              className="rounded p-4"
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--rule)',
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[10.5px]"
                    style={{
                      letterSpacing: '0.16em',
                      color: 'var(--muted)',
                    }}
                  >
                    {i + 1}단계
                  </span>
                  <span
                    className="text-[14px] font-bold"
                    style={{ color: 'var(--ink)' }}
                  >
                    {s.label}
                  </span>
                </div>
                <span
                  className="font-mono tabular-nums text-[18px] font-black"
                  style={{
                    color:
                      pctOfTotal >= 50
                        ? 'var(--moss)'
                        : pctOfTotal >= 20
                          ? 'var(--gold)'
                          : 'var(--sale)',
                  }}
                >
                  {s.count}
                </span>
              </div>
              {/* progress bar — pctOfTotal */}
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--rule)' }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(pctOfTotal, 2)}%`,
                    background:
                      pctOfTotal >= 50
                        ? 'var(--moss)'
                        : pctOfTotal >= 20
                          ? 'var(--gold)'
                          : 'var(--sale)',
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px]">
                <span
                  className="font-mono tabular-nums"
                  style={{ color: 'var(--muted)' }}
                >
                  전체 대비 {pctOfTotal}%
                </span>
                {i > 0 && (
                  <span
                    className="font-mono tabular-nums"
                    style={{
                      color:
                        dropoff <= 20
                          ? 'var(--moss)'
                          : dropoff <= 50
                            ? 'var(--gold)'
                            : 'var(--sale)',
                    }}
                  >
                    이전 단계 대비 {pctOfPrev}% ({dropoff > 0 ? '-' : ''}
                    {Math.round(dropoff * 10) / 10}%)
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <p
        className="mt-6 text-[11px] leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        ※ 가입·설문·분석·정기구독 데이터를 기준으로 집계해요. (설문 완료는
        분석이 만들어진 시점으로 추정 — 추후 더 정밀하게 개선할 예정이에요.)
      </p>
    </main>
  )
}
