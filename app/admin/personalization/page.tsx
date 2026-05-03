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
  ])

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
        <Link
          href="/admin"
          className="text-[12px] text-muted hover:text-text"
        >
          ← Admin
        </Link>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="총 처방" value={totalFormulas ?? 0} unit="건" />
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
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
}) {
  return (
    <div className="bg-white border border-rule rounded-2xl px-4 py-3.5">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="font-serif"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
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
