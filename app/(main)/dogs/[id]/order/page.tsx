// audit #101 — /dogs/[id]/order server wrapper. dog ownership + 최신
// dog_formulas + profile + 매핑된 products 4-6개를 server prefetch. 인증
// 미통과/소유 X → server redirect (이전: client loading spinner + flash).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Formula } from '@/lib/personalization/types'
import OrderClient, {
  type OrderProduct,
  type OrderProfileInitial,
} from './OrderClient'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'

// 라인/토퍼 → slug 매핑은 skuMap (단일 SSOT) 에서 import. 이전엔 page 와
// OrderClient 가 각자 사본을 들고 있어 drift + 삭제된 토퍼 slug 를 가리키는
// 버그가 있었음 (skuMap.gateAvailability 가 미오픈 제품 재분배).

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fresh?: string }>
}) {
  const { id: dogId } = await params
  // 분석 카드 CTA 가 넘겨준 화식 비율(?fresh=30|60|100) → 초기 선택.
  const freshParam = Number((await searchParams).fresh)
  const initialFresh =
    freshParam === 60 ? 60 : freshParam === 100 ? 100 : 30

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${dogId}/order`)
  }

  // dog 소유 + 최신 formula + profile 병렬 prefetch.
  const [{ data: dog }, { data: formulaRow }, { data: prof }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('name')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('dog_formulas')
        .select(
          'cycle_number, formula, reasoning, transition_strategy, ' +
            'algorithm_version, daily_kcal, daily_grams, user_adjusted',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('cycle_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('name, phone, zip, address, address_detail')
        .eq('id', user.id)
        .maybeSingle(),
    ])

  if (!dog) {
    redirect('/dogs')
  }
  const dogName = (dog as { name: string }).name

  // formula null 일 때는 client 가 empty CTA 노출 — page redirect 안 함.
  let formula: Formula | null = null
  if (formulaRow) {
    // audit #79: dog_formulas formula/reasoning 컬럼은 jsonb — generated type
    // 보다 코드 모델이 더 정확. 가공 후 prop drill.
    const f = formulaRow as unknown as {
      cycle_number: number
      formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
      reasoning: Formula['reasoning']
      transition_strategy: Formula['transitionStrategy']
      algorithm_version: string
      daily_kcal: number
      daily_grams: number
      user_adjusted: boolean
    }
    formula = {
      lineRatios: f.formula.lineRatios,
      toppers: f.formula.toppers,
      reasoning: f.reasoning,
      transitionStrategy: f.transition_strategy,
      dailyKcal: f.daily_kcal,
      dailyGrams: f.daily_grams,
      cycleNumber: f.cycle_number,
      algorithmVersion: f.algorithm_version,
      userAdjusted: f.user_adjusted,
    }
  }

  // products map (slug → row). formula 없으면 empty 로 진입해도 client 가 어차피
  // 안내문만 노출 — fetch skip.
  let products: Record<string, OrderProduct> = {}
  if (formula) {
    const allSlugs = [
      ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
      ...Object.values(TOPPER_TO_SLUG),
    ]
    const { data: prodList } = await supabase
      .from('products')
      .select(
        'id, name, slug, price, sale_price, image_url, stock, ' +
          'net_weight_g, is_subscribable, nutrition_facts',
      )
      .in('slug', allSlugs)
      .eq('is_active', true)
    const map: Record<string, OrderProduct> = {}
    for (const p of ((prodList ?? []) as unknown) as OrderProduct[]) {
      map[p.slug] = p
    }
    products = map
  }

  const profile: OrderProfileInitial = (() => {
    if (!prof) {
      return {
        name: '',
        phone: '',
        zip: '',
        address: '',
        address_detail: '',
        prefilled: false,
      }
    }
    const p = prof as {
      name?: string | null
      phone?: string | null
      zip?: string | null
      address?: string | null
      address_detail?: string | null
    }
    return {
      name: p.name ?? '',
      phone: p.phone ?? '',
      zip: p.zip ?? '',
      address: p.address ?? '',
      address_detail: p.address_detail ?? '',
      // client 와 같은 룰 — name/phone/address 셋 중 하나라도 있으면 hint.
      prefilled: !!(p.name || p.phone || p.address),
    }
  })()

  return (
    <OrderClient
      dogId={dogId}
      userId={user.id}
      dogName={dogName}
      formula={formula}
      products={products}
      profile={profile}
      initialFresh={initialFresh}
    />
  )
}
