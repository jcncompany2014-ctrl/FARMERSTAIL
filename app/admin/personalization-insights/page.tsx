import { redirect } from 'next/navigation'
import {
  BarChart3,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { isoDaysAgo } from '@/lib/persona'

export const dynamic = 'force-dynamic'

/**
 * /admin/personalization-insights — admin 신뢰도 분포 + 반사실 모니터링
 * + 능동 개입 A/B 패널 (B-97, B-98, B-99, B-100).
 *
 * # 카드
 *  1. 측정 도구 method 분포 (weight/activity/feed)
 *  2. accuracy_user_boost ON 비율
 *  3. 최근 sensitivity_snapshots top_variable 빈도
 *  4. push_log 카테고리별 발송 vs CTR (간단 비율)
 */
export default async function PersonalizationInsightsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/personalization-insights')
  if (!(await isAdmin(supabase, user))) redirect('/')

  // 측정 도구 분포
  const { data: weightDist } = await supabase
    .from('dogs')
    .select('weight_method')
  const { data: activityDist } = await supabase
    .from('dogs')
    .select('activity_method')
  const { data: feedDist } = await supabase
    .from('dogs')
    .select('feed_method')

  // boost ON 비율
  const { count: totalDogs } = await supabase
    .from('dogs')
    .select('id', { count: 'exact', head: true })
  const { count: boostedDogs } = await supabase
    .from('dogs')
    .select('id', { count: 'exact', head: true })
    .gt('accuracy_user_boost', 0)

  // 최근 30일 sensitivity_snapshots top_variable 분포
  const { data: snapshots } = await supabase
    .from('dog_sensitivity_snapshots')
    .select('top_variable')
    .gte(
      'snapshot_at',
      isoDaysAgo(30),
    )
    .limit(5000)

  // push_log 카테고리 분포
  const { data: pushRows } = await supabase
    .from('push_log')
    .select('category')
    .gte('sent_at', isoDaysAgo(30))
    .limit(5000)

  const weightHist = histogram(
    (weightDist ?? []).map(
      (r: { weight_method: string | null }) => r.weight_method ?? 'unknown',
    ),
  )
  const activityHist = histogram(
    (activityDist ?? []).map(
      (r: { activity_method: string | null }) =>
        r.activity_method ?? 'unknown',
    ),
  )
  const feedHist = histogram(
    (feedDist ?? []).map(
      (r: { feed_method: string | null }) => r.feed_method ?? 'unknown',
    ),
  )
  const topVarHist = histogram(
    (snapshots ?? []).map(
      (r: { top_variable: string }) => r.top_variable,
    ),
  )
  const pushHist = histogram(
    (pushRows ?? []).map(
      (r: { category: string | null }) => r.category ?? 'none',
    ),
  )

  const boostPct =
    totalDogs && totalDogs > 0
      ? Math.round(((boostedDogs ?? 0) / totalDogs) * 100)
      : 0

  return (
    <main className="px-5 pb-24 pt-6 max-w-3xl mx-auto">
      <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
        맞춤 분석
      </h1>
      <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
        맞춤 추천이 잘 돌아가는지 뒤에서 점검하는 곳이에요. 고객들이 체중을
        어떤 방식으로 재는지, 계산이 얼마나 믿을 만한지 같은 내부 품질
        지표를 봐요.
      </p>

      <Card icon={<BarChart3 className="w-4 h-4" />} title="측정 도구 분포">
        <Distribution title="체중" data={weightHist} />
        <Distribution title="활동" data={activityHist} />
        <Distribution title="급여" data={feedHist} />
      </Card>

      <Card icon={<Sparkles className="w-4 h-4" />} title="자기 표명 boost">
        <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
          전체 강아지 중 boost ON: <strong>{boostedDogs ?? 0}</strong> /{' '}
          {totalDogs ?? 0} ({boostPct}%)
        </p>
      </Card>

      <Card
        icon={<TrendingUp className="w-4 h-4" />}
        title="최근 30일 sensitivity top_variable"
      >
        <Distribution title="가장 영향 큰 변수" data={topVarHist} />
      </Card>

      <Card
        icon={<BarChart3 className="w-4 h-4" />}
        title="최근 30일 push 발송 분포"
      >
        <Distribution title="카테고리" data={pushHist} />
      </Card>
    </main>
  )
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className="mt-4 rounded-lg border bg-white p-5"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--terracotta)' }}>
        {icon}
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {title}
        </h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Distribution({
  title,
  data,
}: {
  title: string
  data: Map<string, number>
}) {
  const total = Array.from(data.values()).reduce((s, n) => s + n, 0)
  const sorted = Array.from(data.entries()).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return (
      <div className="text-[11.5px] text-muted">{title}: 데이터 없음</div>
    )
  }
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
        {title} ({total}건)
      </div>
      <div className="space-y-1">
        {sorted.map(([key, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={key} className="flex items-center gap-2 text-[11.5px]">
              <span
                className="w-24 truncate"
                style={{ color: 'var(--ink)' }}
              >
                {key}
              </span>
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--bg)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: 'var(--terracotta)',
                  }}
                />
              </div>
              <span
                className="font-mono text-muted tabular-nums w-16 text-right"
              >
                {count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function histogram(values: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const v of values) {
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}
