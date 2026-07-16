// audit #101 — /dogs/[id] server wrapper. auth + dog ownership + 모든 정적
// 데이터 (dog, ownerName, weight logs, formula, checkins, subs) 를 server 에서
// 한 번에 prefetch → DogDetailClient 에 prop drill.
//
// 이전: client useEffect 에서 5+ supabase 호출 → spinner ~800ms.
// 이후: server-side parallel fetch + 즉시 페인트. 인증/소유 redirect 도 서버.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DogDetailClient from './DogDetailClient'
import { buildDogInsight } from '@/lib/dog-insight'
import type { AiAnalysisJson } from '@/lib/nutrition/ai-prompt'
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
  const [logsRes, formulaRes, subsRes, weightTrendRes, surveyRes, analysisRes] =
    await Promise.all([
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
            'total_deliveries, total_amount, billing_key, created_at, ' +
            // subscriptionState() 정확 판정용 — 없으면 '시작 전'을 '일시정지'로 오표시.
            'failed_charge_count, requires_billing_key_renewal, ' +
            // 실제 배송 레시피(정본). dog_formulas(추천)가 아니라 이걸 카드에 보여준다.
            'subscription_items(product_name, quantity)',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false }),
      // 추세 분석용 — 6개월치 체중 (위의 logs 는 최근 10건만이라 별도 fetch).
      // ⚠️ ascending 이면 limit 40 이 '가장 오래된 40건'을 집어 자주 기록하는
      //    보호자(6개월 40건 초과)의 최신 기록이 통째로 빠진다 → descending.
      //    소비처(evaluateInterventionWindow · buildDogInsight) 둘 다 내부에서
      //    정렬하므로 순서에 무관.
      supabase
        .from('weight_logs')
        .select('measured_at, weight')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .gte('measured_at', trendSinceIso)
        .order('measured_at', { ascending: false })
        .limit(40),
      // BCS — 최신 survey. created_at 은 개요 인사이트의 '재설문 노트' 판정용
      // (사장님 2026-07-14 "설문 다시 하면 그때 개요에 정보 추가").
      supabase
        .from('surveys')
        .select('answers, created_at')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 최신 분석 — 개요 AI 코멘트용. 첫 설문 전이면 행이 없어 코멘트 자체가 안 뜬다.
      // structured_analysis 가 있으면 그걸 즉시 표시(같은 캐시 → 분석 페이지와 같은 글).
      supabase
        .from('analyses')
        .select('id, structured_analysis')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

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

  const surveyAnswers = ((surveyRes.data?.answers as unknown) ?? {}) as {
    bcsExact?: number
  }
  const lastSurveyAt =
    (surveyRes.data as { created_at?: string } | null)?.created_at ?? null
  const trendLogs = (weightTrendRes.data ?? []) as Array<{
    measured_at: string
    weight: number
  }>

  // 개요 인사이트 멘트 — 체중 기록 기반, 상황마다 다른 문구(사장님 2026-07-14).
  // 순수 함수 + 결정적 문구 선택이라 하이드레이션 안전. 체중을 새로 기록하면
  // DogDetailClient 가 router.refresh() 로 여기부터 다시 계산시킨다.
  const insight = buildDogInsight({
    dogName: dog.name,
    weightLogs: trendLogs,
    lastSurveyAt,
    bcs: surveyAnswers.bcsExact ?? null,
  })

  // 개요 AI 코멘트 게이트(사장님 2026-07-16):
  //  · 첫 설문/분석 전이면 안 뜸(analysisRow 없음).
  //  · **첫 코멘트는 전원 무료**라 구독 여부와 무관하게 표시한다. 2주마다 갱신되는
  //    refresh 리밋 해제만 구독자 전용인데, 그 판정은 /api/analysis/structured 가
  //    한다(비구독자는 첫 코멘트 동결 → AI 0). 여기선 노출만 결정.
  // 같은 analyses.structured_analysis 캐시를 쓰므로 분석 페이지와 **같은 글**이 뜬다.
  const analysisRow = analysisRes.data as
    | { id: string; structured_analysis: AiAnalysisJson | null }
    | null
  const aiComment = analysisRow
    ? {
        analysisId: analysisRow.id,
        cached: analysisRow.structured_analysis ?? null,
      }
    : null

  return (
    <DogDetailClient
      dog={dog}
      initialWeightLogs={initialWeightLogs}
      currentFormula={currentFormula}
      checkinStatus={checkinStatus}
      subscriptions={subscriptions}
      insight={insight}
      aiComment={aiComment}
    />
  )
}
