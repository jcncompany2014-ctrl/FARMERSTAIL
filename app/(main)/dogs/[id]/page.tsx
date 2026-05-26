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
import type {
  Dog,
  WeightLog,
  CurrentFormula,
  CheckinStatus,
  ActiveSubscription,
} from './_components/types'

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

  // 병렬 fetch — profile, weight logs, formula, subs.
  const [profileRes, logsRes, formulaRes, subsRes] = await Promise.all([
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
        'id, status, interval_weeks, coverage_weeks, next_delivery_date, ' +
          'total_deliveries, total_amount, billing_key, created_at',
      )
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }),
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

  return (
    <>
      {/* XL-4 (#13) — 모듈 G 개입 윈도우 카드. urgent/watch 일 때만 렌더. */}
      <InterventionWindowCard dogId={dogId} />
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
