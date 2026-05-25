// B5 — 월간 / 연간 통합 리포트 (app-only).
// 사용자별 모든 강아지의 체중 / 다이어리 / 분석 highlight 집계.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, TrendingUp, BookOpen, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/reports')

  // 한 달 기준 집계 — 체중 측정 횟수, 다이어리 entry, 분석 개수.
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthIso = monthStart.toISOString()

  const [weightRes, diaryRes, analysesRes, dogsRes] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('measured_at', monthIso),
    supabase
      .from('dog_diary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthIso),
    supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthIso),
    supabase
      .from('dogs')
      .select('id, name')
      .eq('user_id', user.id),
  ])

  const monthLabel = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  })

  const stats = [
    {
      Icon: TrendingUp,
      label: '체중 기록',
      value: weightRes.count ?? 0,
      tone: 'var(--terracotta)',
    },
    {
      Icon: BookOpen,
      label: '다이어리',
      value: diaryRes.count ?? 0,
      tone: 'var(--moss)',
    },
    {
      Icon: FlaskConical,
      label: '분석',
      value: analysesRes.count ?? 0,
      tone: 'var(--gold)',
    },
  ] as const

  const dogs = (dogsRes.data ?? []) as Array<{ id: string; name: string }>

  return (
    <main className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href="/dashboard"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          홈
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Reports</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {monthLabel} 리포트
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            이번 달 우리 가족이 함께 한 기록을 한눈에
          </p>
        </div>
      </div>

      <section className="px-5 mt-4">
        <div className="grid grid-cols-3 gap-2">
          {stats.map(({ Icon, label, value, tone }) => (
            <div
              key={label}
              className="rounded border border-rule bg-bg-3 px-3 py-3 text-center"
            >
              <Icon
                className="w-4 h-4 mx-auto"
                strokeWidth={2}
                style={{ color: tone }}
              />
              <p
                className="font-sans mt-1.5"
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                {value}
              </p>
              <p
                className="text-[10px] uppercase tracking-widest mt-0.5"
                style={{ color: tone }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {dogs.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="kicker mb-2">우리 강아지</h2>
          <div className="space-y-2">
            {dogs.map((d) => (
              <Link
                key={d.id}
                href={`/dogs/${d.id}/year-in-review`}
                className="block rounded border border-rule bg-bg-3 px-4 py-3 active:scale-[0.99] transition"
              >
                <p
                  className="font-sans"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}
                >
                  {d.name}의 연간 리뷰 →
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  지난 1년간의 성장, 변화, 감동 순간들
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
