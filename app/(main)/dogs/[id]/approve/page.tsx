// audit #101 — /dogs/[id]/approve server wrapper. auth + dog ownership +
// pending/previous formula 를 server prefetch. cycle 은 ?cycle=N 쿼리.
// Decision 호출 자체는 client (api/personalization/approve POST).
//
// # 금액 표시 (2026-07-17 — 사장님 "처방 → 가격 연동")
// 처방이 바뀌면 박스 분량이 바뀌고 **결제 금액도 바뀐다**. 그런데 이 화면은
// 비율(%)·kcal 만 보여주고 승인을 받았다 — 즉 **보호자가 얼마를 내게 되는지
// 모른 채 동의**하는 상태였다(전자상거래법 §13의2 '구성 변경 시 사전 동의'의
// 취지와도 어긋남). 그래서 서버에서 `priceForFormula` 정본으로 새 금액을
// 재산정해 "지금 → 새 금액" 을 보여준다.
//
// ⚠️ 계산은 반드시 `lib/personalization/boxPricing` 정본만 — /order 가 구독을
// 만들 때 쓰는 함수와 같아야 "주문서 금액 ≠ 승인 금액" 이 안 생긴다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ApproveClient from './ApproveClient'
import type { Formula } from '@/lib/personalization/types'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  priceForFormula,
  type BoxProduct,
} from '@/lib/personalization/boxPricing'
import { subscriptionState, type SubLike } from '@/lib/subscription-state'

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

  // ── 금액 재산정 ──────────────────────────────────────────────
  // 이 강아지의 구독에서 화식 비율(고객이 고른 티어)과 현재 청구액을 가져와,
  // 새 처방으로 박스를 다시 구성했을 때의 금액을 정본 계산으로 낸다.
  const pricing = pending ? await computePricing(supabase, dogId, pending) : null

  return (
    <ApproveClient
      dogId={dogId}
      dogName={dogName}
      cycleNumber={cycleNumber}
      pending={pending}
      previous={previous}
      pricing={pricing}
    />
  )
}

/** 승인 화면에 보여줄 금액. 하나라도 불확실하면 **null** — 돈은 추측하지 않는다. */
export type ApprovePricing = {
  /** 지금 내고 있는 2주 청구액 (subscriptions.total_amount). */
  currentTotal: number
  /** 새 처방으로 다시 구성했을 때의 2주 청구액. */
  newTotal: number
  /** 화식 비율 티어 (30/60/100) — 금액 근거 표시용. */
  freshRatio: number
}

async function computePricing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dogId: string,
  pending: Formula,
): Promise<ApprovePricing | null> {
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select(
      'fresh_ratio, total_amount, status, billing_key, next_delivery_date, ' +
        'failed_charge_count, requires_billing_key_renewal',
    )
    .eq('dog_id', dogId)
    .maybeSingle()
  if (!subRow) return null

  const sub = subRow as unknown as SubLike & {
    fresh_ratio: number | null
    total_amount: number
  }
  // 진행 중인 구독이 아니면 청구 기준이 없다 → 금액 표시 안 함.
  if (subscriptionState(sub) !== 'active') return null
  // 화식 비율을 모르면 분량이 안 정해진다 → 틀린 금액을 보여주느니 안 보여준다.
  if (sub.fresh_ratio == null || sub.fresh_ratio <= 0) return null
  if (!(sub.total_amount > 0)) return null

  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const { data: prodList } = await supabase
    .from('products')
    .select('slug, price, sale_price, stock, is_subscribable, nutrition_facts')
    .in('slug', allSlugs)
    .eq('is_active', true)
  const products: Record<string, BoxProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as BoxProduct[]) {
    products[p.slug] = p
  }
  if (Object.keys(products).length === 0) return null

  const next = priceForFormula({
    formula: pending,
    freshRatio: sub.fresh_ratio,
    products,
  })
  if (!(next.total > 0)) return null

  return {
    currentTotal: sub.total_amount,
    newTotal: next.total,
    freshRatio: sub.fresh_ratio,
  }
}
