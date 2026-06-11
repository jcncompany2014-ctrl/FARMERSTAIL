/**
 * XL-3 (#12) — /dogs/[id]/simulate
 *
 * 30일 식단 시뮬레이션 페이지 (출원서 모듈 F 의 보호자 UI).
 * 현재 분석결과를 baseline 으로, 4 시나리오 (또는 custom slider) 의
 * 30일 후 BCS·체중·Bristol 예상 변화를 비교.
 */
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { DietSimBaseline } from '@/lib/diet-simulation'
import SimulateClient from './SimulateClient'

export const dynamic = 'force-dynamic'

// 개인 강아지 데이터 노출 차단 — vet-report 와 같은 보안 정책.
export const metadata: Metadata = {
  title: '식단 시뮬레이션',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

export default async function SimulatePage({ params }: { params: Params }) {
  const { id: dogId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/simulate`)

  // R55 — dog + analyses + survey 3건 1 round-trip Promise.all.
  // 이전: dog sequential → analyses+survey parallel (2 round-trip).
  const [{ data: dog }, { data: analysisRaw }, { data: surveyRaw }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('id, name, weight, user_id')
        .eq('id', dogId)
        .maybeSingle(),
      supabase
        .from('analyses')
        .select(
          'mer, bcs_score, protein_pct, fat_pct, carb_pct, fiber_pct, created_at',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('surveys')
        .select('answers')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
  if (!dog || dog.user_id !== user.id) notFound()

  if (!analysisRaw) {
    return (
      <div className="px-5 py-10 max-w-xl">
        <h1 className="text-2xl font-black text-ink tracking-tight">
          식단 시뮬레이션
        </h1>
        <p className="text-sm text-mute mt-3">
          분석 기록이 필요해요. 먼저 설문을 완료해 주세요.
        </p>
        <Link
          href={`/dogs/${dogId}/survey`}
          className="inline-block mt-4 rounded bg-terracotta px-5 py-2.5 text-sm font-semibold text-paper"
        >
          분석 설문 시작
        </Link>
      </div>
    )
  }

  const surveyAnswers =
    ((surveyRaw?.answers as unknown) ?? {}) as {
      bcsExact?: number
      bristolScore?: number
    }

  // 가드: dog.weight 또는 mer 가 누락이면 시뮬레이션 의미 없음 (division by
  // zero 위험). 분석 다시 권유.
  if (!dog.weight || !analysisRaw.mer) {
    return (
      <div className="px-5 py-10 max-w-xl">
        <h1 className="text-2xl font-black text-ink tracking-tight leading-snug">
          식단 시뮬레이션
        </h1>
        <p className="text-sm text-mute mt-3">
          체중·일일 권장 칼로리 데이터가 부족해 시뮬레이션할 수 없어요.
          분석을 다시 진행해 주세요.
        </p>
        <Link
          href={`/dogs/${dogId}/survey`}
          className="inline-block mt-4 rounded bg-terracotta px-5 py-2.5 text-sm font-semibold text-paper"
        >
          분석 다시 하기
        </Link>
      </div>
    )
  }

  const baseline: DietSimBaseline = {
    mer: analysisRaw.mer,
    weightKg: dog.weight,
    bcs: surveyAnswers.bcsExact ?? analysisRaw.bcs_score ?? 5,
    proteinPct: analysisRaw.protein_pct ?? 25,
    fatPct: analysisRaw.fat_pct ?? 15,
    carbPct: analysisRaw.carb_pct ?? 45,
    fiberPct: analysisRaw.fiber_pct ?? 4,
    bristol: surveyAnswers.bristolScore ?? 4,
  }

  return (
    <div className="px-5 py-5 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-ink tracking-tight leading-snug">
        식단 시뮬레이션
      </h1>
      <p className="text-xs text-mute mt-1 leading-relaxed">
        현재 식단을 기준으로 다른 식단·운동 시나리오의 30일 후 예상 변화를
        비교합니다. 추정치 (실측과 다를 수 있음).
      </p>

      <SimulateClient dogName={dog.name} baseline={baseline} />
    </div>
  )
}
