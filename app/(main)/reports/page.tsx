// B5 — 월간 / 연간 통합 리포트 (app-only).
// 사용자별 모든 강아지의 체중 / 다이어리 / 분석 highlight 집계.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TrendingUp, BookOpen, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ReportExportButton from './ReportExportButton'
import { petName } from '@/lib/korean'

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
    // 서버=UTC. timeZone 없으면 매월 1일 KST 00~09시(UTC 전월)에 지난 달로 표시됨.
    timeZone: 'Asia/Seoul',
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
    <div className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <div className="mt-3">
          <span className="kicker inline-block">Reports</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {monthLabel} 리포트
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            이번 달 우리 가족이 함께 한 기록을 한눈에
          </p>
          <div className="mt-3">
            <ReportExportButton monthLabel={monthLabel} />
          </div>
        </div>
      </div>

      <section className="px-5 mt-4 ft-report-capture">
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
                className="text-[10.5px] uppercase tracking-widest mt-0.5"
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
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}
                >
                  {petName(d.name)}의 연간 리뷰 →
                </p>
                <p className="text-[10.5px] text-muted mt-0.5">
                  지난 1년간의 성장, 변화, 감동 순간들
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dogs.length === 0 && (
        <section className="px-5 mt-6">
          <div
            className="rounded px-5 py-8 text-center"
            style={{ background: 'var(--bg-2)', border: '1px dashed var(--rule-2)' }}
          >
            <p className="text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>
              아직 등록된 강아지가 없어요
            </p>
            <p
              className="mt-1.5 text-[12px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              강아지를 등록하면 이번 달 기록이 리포트로 모여요
            </p>
            <Link
              href="/dogs/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--terracotta)', color: '#fff' }}
            >
              강아지 등록하기 →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
