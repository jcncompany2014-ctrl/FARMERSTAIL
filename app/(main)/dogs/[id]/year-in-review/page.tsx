import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  PartyPopper,
  Scale,
  ClipboardList,
  BookOpen,
  Camera,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { josa, petName } from '@/lib/korean'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '한 해 회고',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

/**
 * /dogs/[id]/year-in-review — 최근 365일 동안의 함께한 한 해 회고.
 *
 * 사용자 자율 진입 (마일스톤 카드 365일에서 cta 로 연결 가능). 발표 톤은
 * "정성껏 챙겨주셔서 고마워요" — 견 주어, 시스템 성공 X.
 *
 * # 데이터
 *  - dogs: 등록일 + 이름 + 사진
 *  - weight_logs: 시작·종료·min·max (체중 변화 추세)
 *  - dog_checkins: 365일 카운트
 *  - analyses: 365일 카운트
 *  - dog_diary: 365일 카운트 (있을 때만 — 테이블 없으면 silent skip)
 *
 * # 비유효 진입
 *  - dog 가입 후 30일 미만이면 "아직 한 해가 안 됐어요" 안내.
 *  - 가입 365일+ 인 사용자는 첫 진입 시 일종의 surprise — share CTA 도 포함.
 */
export default async function YearInReviewPage({
  params,
}: {
  params: Params
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/year-in-review`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name, photo_url, created_at')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  const dogRow = dog as {
    id: string
    name: string
    photo_url: string | null
    created_at: string
  }

  // 기간 — 등록일 ~ 365일 후 (또는 등록일 ~ 오늘 중 짧은 쪽).
  const registeredAt = new Date(dogRow.created_at)
  const yearAfter = new Date(registeredAt.getTime() + 365 * 86_400_000)
  const now = new Date()
  const periodEnd = now < yearAfter ? now : yearAfter
  const sinceIso = registeredAt.toISOString()
  const untilIso = periodEnd.toISOString()
  const daysIn = Math.floor(
    (periodEnd.getTime() - registeredAt.getTime()) / 86_400_000,
  )
  // 1년 미만 계정(예: 66일)엔 "한 해" 문구가 거짓 → 실제 기간에 맞춰 톤 전환.
  // (제목은 항상 실제 일수 "함께한 N일" 로 정직하게.) 사장님 2026-07-23 점검.
  const isFullYear = daysIn >= 365

  const [
    { data: weightLogs },
    { count: checkinCount },
    { count: analysisCount },
    { count: diaryCount },
  ] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('weight, measured_at')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('measured_at', sinceIso)
      .lte('measured_at', untilIso)
      .order('measured_at', { ascending: true }),
    supabase
      .from('dog_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    supabase
      .from('dog_diary')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('entry_date', sinceIso.slice(0, 10))
      .lte('entry_date', untilIso.slice(0, 10)),
  ])

  type WLog = { weight: number; measured_at: string }
  const wlogs = ((weightLogs ?? []) as WLog[]).filter(
    (w) => typeof w.weight === 'number' && Number.isFinite(w.weight),
  )
  const weightStart = wlogs[0]?.weight ?? null
  const weightEnd = wlogs[wlogs.length - 1]?.weight ?? null
  const weightDelta =
    weightStart != null && weightEnd != null
      ? Math.round((weightEnd - weightStart) * 100) / 100
      : null
  const weightMax = wlogs.length
    ? Math.max(...wlogs.map((w) => w.weight))
    : null
  const weightMin = wlogs.length
    ? Math.min(...wlogs.map((w) => w.weight))
    : null

  if (daysIn < 30) {
    return (
      <div
        className="min-h-[80vh] flex items-center justify-center px-5 py-10"
        style={{ background: 'var(--bg)' }}
      >
        <div className="max-w-sm w-full text-center rounded border bg-bg-3 px-6 py-7" style={{ borderColor: 'var(--rule)' }}>
          <PartyPopper
            className="w-9 h-9 mx-auto"
            strokeWidth={1.8}
            style={{ color: 'var(--gold)' }}
            aria-hidden
          />
          <h1
            className="font-sans mt-3"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            아직 한 해가 안 됐어요
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-text/70">
            {josa(petName(dogRow.name), '과', '와')} 함께한 시간이 {daysIn}일이에요.
            <br />
            조금만 더 모이면 한 해 회고를 볼 수 있어요.
          </p>
          <Link
            href={`/dogs/${dogRow.id}`}
            className="mt-5 inline-block text-[12px] font-bold text-muted hover:text-text"
          >
            돌아가기 ›
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12" style={{ background: 'var(--bg)' }}>
      {/* 히어로 */}
      <section className="px-5 pt-6">
        <span className="kicker" style={{ color: 'var(--terracotta)' }}>
          {isFullYear ? 'Year in Review · 한 해 회고' : '함께한 기록 · 돌아보기'}
        </span>
        <h1
          className="font-sans mt-2 leading-tight"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {josa(petName(dogRow.name), '과', '와')} 함께한 {daysIn}일
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text/80">
          정성껏 챙겨주셔서 고마워요. {isFullYear ? '한 해를' : '그동안을'} 짧게 돌아볼게요.
        </p>
      </section>

      {/* 카드 grid */}
      <section className="px-5 mt-6 grid grid-cols-2 gap-3">
        <StatCard
          icon={<ClipboardList className="w-5 h-5" strokeWidth={2} />}
          label="분석"
          value={`${analysisCount ?? 0}회`}
          accent="var(--terracotta)"
        />
        <StatCard
          icon={<Scale className="w-5 h-5" strokeWidth={2} />}
          label="체중 기록"
          value={`${wlogs.length}회`}
          accent="var(--moss)"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" strokeWidth={2} />}
          label="체크인"
          value={`${checkinCount ?? 0}회`}
          accent="var(--terracotta)"
        />
        <StatCard
          icon={<Camera className="w-5 h-5" strokeWidth={2} />}
          label="일기"
          value={`${diaryCount ?? 0}편`}
          accent="var(--gold)"
        />
      </section>

      {/* 체중 변화 narrative */}
      {weightDelta !== null && weightStart != null && weightEnd != null && (
        <section className="px-5 mt-5">
          <div
            className="rounded border bg-bg-3 px-5 py-4"
            style={{ borderColor: 'var(--rule)' }}
          >
            <span className="kicker" style={{ color: 'var(--moss)' }}>
              Weight Story · 체중 이야기
            </span>
            <div className="mt-2 flex items-center gap-3">
              {weightDelta > 0.05 ? (
                <TrendingUp
                  className="w-5 h-5 shrink-0"
                  strokeWidth={2.2}
                  style={{ color: 'var(--moss)' }}
                />
              ) : weightDelta < -0.05 ? (
                <TrendingDown
                  className="w-5 h-5 shrink-0"
                  strokeWidth={2.2}
                  style={{ color: 'var(--terracotta)' }}
                />
              ) : (
                <Minus
                  className="w-5 h-5 shrink-0"
                  strokeWidth={2.2}
                  style={{ color: 'var(--muted)' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className="font-sans leading-tight"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {weightStart} kg → {weightEnd} kg
                </p>
                <p className="mt-0.5 text-[12px] text-muted leading-relaxed">
                  {weightDelta > 0.05
                    ? `${Math.abs(weightDelta)} kg 늘었어요 — 잘 자라고 있어요`
                    : weightDelta < -0.05
                      ? `${Math.abs(weightDelta)} kg 변화 — 함께 살펴봐도 좋아요`
                      : '안정적인 체중이에요'}
                  {weightMin != null && weightMax != null && (
                    <> · 최저 {weightMin} kg / 최고 {weightMax} kg</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 감사 메시지 */}
      <section className="px-5 mt-5">
        <div
          className="rounded px-5 py-5"
          style={{
            background: 'color-mix(in srgb, var(--terracotta) 8%, white)',
            border: '1px solid color-mix(in srgb, var(--terracotta) 25%, transparent)',
          }}
        >
          <PartyPopper
            className="w-6 h-6"
            strokeWidth={2}
            style={{ color: 'var(--terracotta)' }}
            aria-hidden
          />
          <p
            className="mt-2 font-sans leading-snug"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {isFullYear ? '한 해 동안' : '그동안'} 정성껏 챙겨주셔서 고마워요
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text/75">
            {petName(dogRow.name)}의 작은 변화 하나하나가 모여 이번 회고가 됐어요.
            {isFullYear ? ' 다음 한 해도' : ' 앞으로도'} 천천히, 함께 가요.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mt-5">
        <Link
          href={`/dogs/${dogRow.id}`}
          className="flex items-center justify-center gap-1.5 py-3 rounded text-[12px] font-bold text-white transition active:scale-[0.99]"
          style={{ background: 'var(--terracotta)' }}
        >
          돌아가기
        </Link>
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      className="rounded border bg-bg-3 px-4 py-4 flex flex-col gap-2"
      style={{ borderColor: 'var(--rule)' }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, white)`,
          color: accent,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <span
          className="kicker block"
          style={{ color: 'var(--muted)' }}
        >
          {label}
        </span>
        <p
          className="font-sans mt-0.5"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.015em',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
