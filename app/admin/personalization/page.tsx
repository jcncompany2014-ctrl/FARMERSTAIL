import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import SimulatorClient from './SimulatorClient'

export const dynamic = 'force-dynamic'

/**
 * /admin/personalization — 알고리즘 시뮬레이터 + 운영 통계.
 *
 * 알고리즘 (decideFirstBox / decideNextBox) 를 임의 입력으로 시뮬레이션하고
 * 결과를 즉시 확인. 운영자가 "이 강아지에겐 어떤 비율?" 검증, 새 룰 검토,
 * 클레임 대응 시 사용.
 *
 * 추가 통계:
 *  - 케어 목표 분포 (수요 예측)
 *  - user_adjusted 비율 (알고리즘 정확도 KPI)
 *  - cycle 별 응답률 (체크인 incentive 효과 측정)
 */
export default async function AdminPersonalizationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/personalization')
  if (!(await isAdmin(supabase, user))) redirect('/')

  // 운영 KPI — 빠른 집계.
  const [
    { count: totalFormulas },
    { count: adjustedFormulas },
    { count: totalCheckins },
    { count: pendingCount },
    { data: pendingNearTimeout },
    { data: satisfactionRows },
    { data: cycleResponse },
  ] = await Promise.all([
    supabase
      .from('dog_formulas')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('dog_formulas')
      .select('*', { count: 'exact', head: true })
      .eq('user_adjusted', true),
    supabase
      .from('dog_checkins')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('dog_formulas')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending_approval'),
    // 5일 타임아웃 임박 (3일+ 지난 pending) — 직접 푸시 reminder 대상.
    supabase
      .from('dog_formulas')
      .select('id, dog_id, cycle_number, proposed_at')
      .eq('approval_status', 'pending_approval')
      .lt(
        'proposed_at',
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order('proposed_at', { ascending: true })
      .limit(20),
    supabase
      .from('dog_checkins')
      .select('overall_satisfaction')
      .not('overall_satisfaction', 'is', null),
    supabase
      .from('dog_checkins')
      .select('cycle_number, checkpoint'),
  ])

  // 만족도 분포 (1-5 점)
  const satisfaction: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
  for (const r of (satisfactionRows ?? []) as Array<{
    overall_satisfaction: 1 | 2 | 3 | 4 | 5
  }>) {
    satisfaction[r.overall_satisfaction] += 1
  }
  const totalSatisfaction = Object.values(satisfaction).reduce(
    (s, v) => s + v,
    0,
  )

  // cycle 별 응답률 — week_2 / week_4 분리
  const responseByCycle = ((cycleResponse ?? []) as Array<{
    cycle_number: number
    checkpoint: 'week_2' | 'week_4'
  }>).reduce<
    Record<number, { week_2: number; week_4: number }>
  >((acc, r) => {
    acc[r.cycle_number] ??= { week_2: 0, week_4: 0 }
    acc[r.cycle_number][r.checkpoint] += 1
    return acc
  }, {})

  // 케어 목표 분포 — DB 직접 group by 어려우니 client-side 집계.
  const { data: surveyGoals } = await supabase
    .from('surveys')
    .select('care_goal')
    .not('care_goal', 'is', null)

  const goalCounts = ((surveyGoals as unknown as { care_goal: string }[]) ?? []).reduce<
    Record<string, number>
  >((acc, r) => {
    acc[r.care_goal] = (acc[r.care_goal] ?? 0) + 1
    return acc
  }, {})

  const adjustedRate =
    totalFormulas && totalFormulas > 0
      ? Math.round((100 * (adjustedFormulas ?? 0)) / totalFormulas)
      : 0

  return (
    <main className="px-5 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: 'var(--terracotta)' }}
          >
            Admin · Personalization
          </span>
          <h1
            className="font-serif mt-1"
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            알고리즘 시뮬레이터
          </h1>
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          <Link
            href="/admin/algorithm"
            className="text-[11px] font-bold text-terracotta hover:underline"
          >
            알고리즘 데이터 편집 →
          </Link>
          <Link
            href="/admin"
            className="text-[11px] text-muted hover:text-text"
          >
            ← Admin home
          </Link>
        </div>
      </div>

      {/* KPI cards — 2 row: 4개 + 4개 */}
      <section className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard label="총 박스" value={totalFormulas ?? 0} unit="건" />
        <KpiCard
          label="사용자 조정"
          value={`${adjustedRate}%`}
          unit={`(${adjustedFormulas ?? 0}/${totalFormulas ?? 0})`}
          hint="↓ 일수록 알고리즘 정확"
        />
        <KpiCard
          label="체크인 응답"
          value={totalCheckins ?? 0}
          unit="건"
        />
        <KpiCard
          label="동의 대기"
          value={pendingCount ?? 0}
          unit="건"
          hint={
            (pendingNearTimeout ?? []).length > 0
              ? `${(pendingNearTimeout ?? []).length}건 timeout 임박`
              : '5일 무응답 → 자동 declined'
          }
          warn={(pendingNearTimeout ?? []).length > 0}
        />
      </section>

      {/* pending_approval 임박 큐 */}
      {(pendingNearTimeout ?? []).length > 0 && (
        <section className="mb-6 bg-terracotta/5 border-2 border-terracotta/30 rounded-2xl p-5">
          <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-terracotta mb-3">
            ⚠️ 동의 timeout 임박 ({(pendingNearTimeout ?? []).length})
          </h3>
          <ul className="space-y-1.5">
            {(pendingNearTimeout ?? []).map((row) => {
              const r = row as unknown as {
                id: string
                dog_id: string
                cycle_number: number
                proposed_at: string
              }
              const daysLeft = Math.max(
                0,
                5 -
                  Math.ceil(
                    (Date.now() - new Date(r.proposed_at).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
              )
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between text-[12px] py-1.5 px-3 bg-white rounded-lg"
                >
                  <Link
                    href={`/admin/personalization?dog=${r.dog_id}`}
                    className="font-mono text-text hover:text-terracotta"
                  >
                    dog={r.dog_id.slice(0, 8)}… cycle {r.cycle_number}
                  </Link>
                  <span
                    className={`font-bold text-[10.5px] ${
                      daysLeft === 0
                        ? 'text-terracotta'
                        : daysLeft === 1
                          ? 'text-gold'
                          : 'text-muted'
                    }`}
                  >
                    {daysLeft === 0 ? '오늘 timeout' : `D-${daysLeft}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 만족도 분포 + cycle 응답률 (2열) */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        {totalSatisfaction > 0 && (
          <div className="bg-white border border-rule rounded-2xl p-5">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-text mb-3">
              만족도 분포 ({totalSatisfaction})
            </h3>
            <ul className="space-y-2">
              {([5, 4, 3, 2, 1] as const).map((score) => {
                const count = satisfaction[score]
                const pct = Math.round((count / totalSatisfaction) * 100)
                const color =
                  score >= 4
                    ? 'var(--moss)'
                    : score === 3
                      ? 'var(--gold)'
                      : 'var(--terracotta)'
                return (
                  <li key={score} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-3 font-mono text-muted">{score}</span>
                    <div className="flex-1 h-2 rounded-full bg-rule overflow-hidden">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.max(2, pct)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right font-bold text-text font-mono">
                      {count}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {Object.keys(responseByCycle).length > 0 && (
          <div className="bg-white border border-rule rounded-2xl p-5">
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-text mb-3">
              cycle 응답
            </h3>
            <ul className="space-y-1.5">
              {Object.entries(responseByCycle)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([cycle, counts]) => (
                  <li
                    key={cycle}
                    className="flex items-center text-[11.5px]"
                  >
                    <span className="font-mono w-12 text-muted">
                      cycle {cycle}
                    </span>
                    <span className="flex-1 inline-flex gap-1.5 items-center">
                      <span className="text-moss font-bold">w2 {counts.week_2}</span>
                      <span className="text-muted">·</span>
                      <span className="text-terracotta font-bold">w4 {counts.week_4}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {/* 케어 목표 분포 */}
      {Object.keys(goalCounts).length > 0 && (
        <section className="mb-6 bg-white border border-rule rounded-2xl p-5">
          <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-text mb-3">
            케어 목표 분포
          </h3>
          <ul className="space-y-1.5">
            {Object.entries(goalCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([goal, count]) => (
                <li
                  key={goal}
                  className="flex items-center text-[12.5px] text-text"
                >
                  <span className="flex-1 font-mono">{goal}</span>
                  <span className="font-black text-terracotta">{count}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* 시뮬레이터 — client component */}
      <SimulatorClient />
    </main>
  )
}

function KpiCard({
  label,
  value,
  unit,
  hint,
  warn,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div
      className={
        'rounded-2xl px-4 py-3.5 ' +
        (warn
          ? 'bg-terracotta/8 border-2 border-terracotta/40'
          : 'bg-white border border-rule')
      }
    >
      <div
        className={
          'text-[10px] font-bold tracking-[0.2em] uppercase ' +
          (warn ? 'text-terracotta' : 'text-muted')
        }
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="font-serif"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: warn ? 'var(--terracotta)' : 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      {hint && (
        <p className="text-[10px] text-muted mt-1.5 leading-relaxed">{hint}</p>
      )}
    </div>
  )
}
