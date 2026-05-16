// audit #101 — /dogs/[id]/approve server wrapper. auth + dog ownership +
// pending/previous formula 를 server prefetch. cycle 은 ?cycle=N 쿼리.
// Decision 호출 자체는 client (api/personalization/approve POST).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApproveClient from './ApproveClient'
import type { Formula } from '@/lib/personalization/types'

type Row = {
  formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
  reasoning: Formula['reasoning']
  transition_strategy: Formula['transitionStrategy']
  algorithm_version: string
  daily_kcal: number
  daily_grams: number
  cycle_number: number
  approval_status: string
  user_adjusted: boolean
}

function toFormula(row: Row): Formula {
  return {
    lineRatios: row.formula.lineRatios,
    toppers: row.formula.toppers,
    reasoning: row.reasoning,
    transitionStrategy: row.transition_strategy,
    dailyKcal: row.daily_kcal,
    dailyGrams: row.daily_grams,
    cycleNumber: row.cycle_number,
    algorithmVersion: row.algorithm_version,
    userAdjusted: row.user_adjusted,
  }
}

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const { id: dogId } = await params
  const sp = await searchParams
  const cycleNumber = Number(sp.cycle ?? '0') || 0

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dogs/${dogId}/approve?cycle=${cycleNumber}`)}`,
    )
  }

  const FORMULA_COLS =
    'formula, reasoning, transition_strategy, algorithm_version, ' +
    'daily_kcal, daily_grams, cycle_number, approval_status, user_adjusted'

  const [{ data: dog }, { data: pendingRow }, prevRes] = await Promise.all([
    supabase
      .from('dogs')
      .select('name')
      .eq('id', dogId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('dog_formulas')
      .select(FORMULA_COLS)
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .eq('cycle_number', cycleNumber)
      .maybeSingle(),
    cycleNumber > 1
      ? supabase
          .from('dog_formulas')
          .select(FORMULA_COLS)
          .eq('dog_id', dogId)
          .eq('user_id', user.id)
          .eq('cycle_number', cycleNumber - 1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!dog) {
    redirect('/dogs')
  }

  const dogName = (dog as { name: string }).name
  const pending = pendingRow ? toFormula(pendingRow as unknown as Row) : null
  const previous = prevRes.data ? toFormula(prevRes.data as unknown as Row) : null

  return (
    <ApproveClient
      dogId={dogId}
      dogName={dogName}
      cycleNumber={cycleNumber}
      pending={pending}
      previous={previous}
    />
  )
}
