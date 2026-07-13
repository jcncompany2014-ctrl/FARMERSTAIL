// audit #101 — /dogs/[id] server wrapper. auth + dog ownership + 모든 정적
// 데이터 (dog, ownerName, weight logs, formula, checkins, subs) 를 server 에서
// 한 번에 prefetch → DogDetailClient 에 prop drill.
//
// 이전: client useEffect 에서 5+ supabase 호출 → spinner ~800ms.
// 이후: server-side parallel fetch + 즉시 페인트. 인증/소유 redirect 도 서버.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DogDetailClient from './DogDetailClient'
import InterventionWindowCard from '@/components/dog/InterventionWindowCard'
import {
  evaluateInterventionWindow,
  type InterventionWindow,
} from '@/lib/intervention-window'
import type {
  Dog,
  WeightLog,
  CurrentFormula,
  CheckinStatus,
  ActiveSubscription,
} from './_components/types'

// R55 perf — Date.now() 를 helper 로 (React 19 purity rule + 컴포넌트 body 외).
function sixMonthsAgoIso(): string {
  return new Date(Date.now() - 180 * 86_400_000).toISOString()
}

export default async function DogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${dogId}`)
  }

  // Explicit user_id filter — admin RLS policy 우회 방어 (#원 client 코드와 동일).
  const { data: dogRow, error: dogErr } = await supabase
    .from('dogs')
    .select('*')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (dogErr || !dogRow) {
    redirect('/dogs')
  }

  // audit #79: generated dogs row 와 도메인 Dog nullable 차이 — cast.
  const dog = dogRow as unknown as Dog

  // R55 perf — 모든 server fetch 통합. 기존 6건 + Intervention 카드 데이터
  // (이전엔 컴포넌트 안에서 sequential fetch — 중복 + waterfall) 1 Promise.all.
  const trendSinceIso = sixMonthsAgoIso()
  const [profileRes, logsRes, formulaRes, subsRes, weightTrendRes, surveyRes] =
    await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
      supabase
        .from('weight_logs')
        .select('id, weight, measured_at, note')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(10),
      supabase
        .from('dog_formulas')
        .select(
          'cycle_number, approval_status, applied_from, applied_until, ' +
            'formula, daily_grams, daily_kcal, user_adjusted',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select(
          'id, status, interval_weeks, coverage_weeks, fresh_ratio, next_delivery_date, ' +
            'total_deliveries, total_amount, billing_key, created_at',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false }),
      // 추세 분석용 — 6개월치 체중 (위의 logs 는 최근 10건만이라 별도 fetch)
      supabase
        .from('weight_logs')
        .select('measured_at, weight')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .gte('measured_at', trendSinceIso)
        .order('measured_at', { ascending: true })
        .limit(40),
      // BCS — 최신 survey
      supabase
        .from('surveys')
        .select('answers')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const ownerFallback = user.email ? user.email.split('@')[0] ?? null : null
  const ownerName =
    (profileRes.data as { name?: string | null } | null)?.name ?? ownerFallback

  const initialWeightLogs = (logsRes.data ?? []) as WeightLog[]
  const currentFormula = formulaRes.data
    ? (formulaRes.data as unknown as CurrentFormula)
    : null
  const subscriptions = (subsRes.data ?? []) as unknown as ActiveSubscription[]

  // 체크인 상태 — 현재 cycle 의 week_2 / week_4 응답 여부. formula 가 있을 때만.
  const checkinStatus: CheckinStatus = { week_2: false, week_4: false }
  if (currentFormula) {
    const { data: checkins } = await supabase
      .from('dog_checkins')
      .select('checkpoint')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .eq('cycle_number', currentFormula.cycle_number)
    for (const c of (checkins ?? []) as Array<{
      checkpoint: 'week_2' | 'week_4'
    }>) {
      checkinStatus[c.checkpoint] = true
    }
  }

  // R55 perf — 개입 윈도우 사전 계산. lib 함수 (pure) → 추가 fetch 없음.
  let interventionWindow: InterventionWindow | null = null
  if (dog.weight) {
    const surveyAnswers = ((surveyRes.data?.answers as unknown) ?? {}) as {
      bcsExact?: number
    }
    const trendLogs = (weightTrendRes.data ?? []) as Array<{
      measured_at: string
      weight: number
    }>
    interventionWindow = evaluateInterventionWindow({
      weightLogs: trendLogs.map((l) => ({
        date: l.measured_at,
        weightKg: l.weight,
      })),
      currentBcs: surveyAnswers.bcsExact ?? 5,
      currentWeightKg: dog.weight,
    })
  }

  return (
    <>
      {/* XL-4 (#13) — 모듈 G 개입 윈도우 카드. urgent/watch 일 때만 렌더. */}
      {interventionWindow && (
        <InterventionWindowCard dogId={dogId} window={interventionWindow} />
      )}
      <DogDetailClient
        dog={dog}
        ownerName={ownerName}
        initialWeightLogs={initialWeightLogs}
        currentFormula={currentFormula}
        checkinStatus={checkinStatus}
        subscriptions={subscriptions}
      />
    </>
  )
}
