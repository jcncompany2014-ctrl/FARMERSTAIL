// /dogs/[id]/plan — 상품(플랜) 페이지 server wrapper (2026-07-13 사장님).
// 분석 결과(신뢰) 와 분리된 '전환' 전용 페이지 — 알고리즘 추천 레시피 + 안전한
// 자유선택(알레르기 잠금) + 화식 비율 + 첫박스 할인. dog 소유 + 최신 formula +
// 매핑 products 를 server prefetch (order/page.tsx 와 동일 소스), PlanClient 로 drill.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Formula } from '@/lib/personalization/types'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import PlanClient, { type PlanProduct } from './PlanClient'

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fresh?: string }>
}) {
  const { id: dogId } = await params
  const freshParam = Number((await searchParams).fresh)
  const initialFresh = freshParam === 60 ? 60 : freshParam === 100 ? 100 : 30

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/plan`)

  const [{ data: dog }, { data: formulaRow }, { data: subRows }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('name')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('dog_formulas')
        .select('cycle_number, formula, reasoning, daily_kcal, daily_grams')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 이 강아지 구독 이력(현재/과거) — 첫 박스 판정. 상태 무관, 강아지별
      // (다른 강아지가 구독 중이어도 새 강아지는 첫 박스). RecommendationBox
      // CTA 분기와 동일 기준.
      supabase
        .from('subscriptions')
        .select('id')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .limit(1),
    ])

  if (!dog) redirect('/dogs')
  const dogName = (dog as { name: string }).name

  let formula: Formula | null = null
  if (formulaRow) {
    const f = formulaRow as unknown as {
      cycle_number: number
      formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
      reasoning: Formula['reasoning']
      daily_kcal: number
      daily_grams: number
    }
    formula = {
      lineRatios: f.formula.lineRatios,
      toppers: f.formula.toppers,
      reasoning: f.reasoning,
      transitionStrategy: 'gradual',
      dailyKcal: f.daily_kcal,
      dailyGrams: f.daily_grams,
      cycleNumber: f.cycle_number,
      algorithmVersion: '',
      userAdjusted: false,
    }
  }

  // 제품 map (slug → row) — 재고/구독 가능/가격 판정용. formula 없으면 skip.
  let products: Record<string, PlanProduct> = {}
  if (formula) {
    const allSlugs = [
      ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
      ...Object.values(TOPPER_TO_SLUG),
    ]
    const { data: prodList } = await supabase
      .from('products')
      .select('slug, price, sale_price, stock, is_subscribable')
      .in('slug', allSlugs)
      .eq('is_active', true)
    const map: Record<string, PlanProduct> = {}
    for (const p of ((prodList ?? []) as unknown) as PlanProduct[]) {
      map[p.slug] = p
    }
    products = map
  }

  // 첫 박스 = 이 강아지 구독 이력 없음. 50% 첫 박스 할인·'첫 박스 기준' 문구는
  // 첫 박스일 때만 (사장님 2026-07-14) — 재구독 강아지는 정가.
  const isFirstBox = (subRows?.length ?? 0) === 0

  return (
    <PlanClient
      dogId={dogId}
      dogName={dogName}
      formula={formula}
      products={products}
      initialFresh={initialFresh}
      isFirstBox={isFirstBox}
    />
  )
}
