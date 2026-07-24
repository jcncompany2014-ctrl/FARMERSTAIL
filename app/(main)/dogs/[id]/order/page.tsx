// audit #101 — /dogs/[id]/order server wrapper. dog ownership + cycle 1
// dog_formulas + profile + 매핑된 products 를 server prefetch. 인증
// 미통과/소유 X → server redirect (이전: client loading spinner + flash).
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { ALL_LINES } from '@/lib/personalization/lines'
import { ratiosFromPicks, MAX_PICKS } from '@/lib/personalization/boxPicks'
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
  searchParams: Promise<{ fresh?: string; recipes?: string }>
}) {
  const { id: dogId } = await params
  // 분석 카드 CTA 가 넘겨준 화식 비율(?fresh=30|50|100) → 초기 선택.
  const sp = await searchParams
  const freshParam = Number(sp.fresh)
  const initialFresh =
    freshParam === 50 ? 50 : freshParam === 100 ? 100 : 30

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
      // ⚠️ cycle 1 고정 — '최신 cycle' 이 아니다 (사장님 2026-07-15 "분명히 닭으로
      // 추천받고 넘어갔는데 최종 배송 정보에서는 오리랑 소를 받아").
      //
      // 분석·플랜은 POST /api/personalization/compute 를 쓰는데 그 라우트는 항상
      // **cycle 1 을 read-or-create** 하고, 최신 analyses 가 처방보다 새로우면
      // 지우고 다시 계산한다. 즉 "지금의 추천" = cycle 1 이다.
      // 여기만 최신 cycle 을 읽어서, 진행 cron 이 만들어 둔 옛 cycle 2(최신 분석
      // 보다 오래된 값)를 보여줬다 → 같은 강아지인데 화면마다 레시피가 달랐다.
      supabase
        .from('dog_formulas')
        .select(
          'cycle_number, formula, reasoning, transition_strategy, ' +
            'algorithm_version, daily_kcal, daily_grams, user_adjusted',
        )
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .eq('cycle_number', 1)
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
      formula: {
        lineRatios: Formula['lineRatios']
        toppers: Formula['toppers']
        needsConsultation?: boolean
      }
      reasoning: Formula['reasoning']
      transition_strategy: Formula['transitionStrategy']
      algorithm_version: string
      daily_kcal: number
      daily_grams: number
      user_adjusted: boolean
    }

    // ★안전 게이트 — 판매 레시피가 전부 알레르기라 자동 추천이 불가한 강아지는
    // 결제로 못 넘어간다. 분석 페이지의 상담 안내(카톡 문의)로 돌려보낸다
    // (2026-07-24: 이 게이트 없으면 알레르기 성분 박스가 결제까지 갔다).
    if (f.formula.needsConsultation) {
      redirect(`/dogs/${dogId}/analysis`)
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

    // 플랜에서 보호자가 직접 고른 레시피(?recipes=weight,premium)가 있으면 그게
    // 이긴다. 이전엔 이 파라미터를 아예 안 읽어서, 플랜에서 닭을 골라 담고
    // 넘어와도 주문 화면이 알고리즘 원본 비율을 그대로 보여줬다
    // (사장님 2026-07-15 "이거 이러면 안 돼 진심으로").
    //
    // 박스 규칙(1종 100% / 2종 50:50)은 ratiosFromPicks 가 강제 — 링크를 손으로
    // 고쳐 3종을 넣어도 앞 2종만 담긴다.
    const picked = (sp.recipes ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r): r is FoodLine => (ALL_LINES as string[]).includes(r))
      .slice(0, MAX_PICKS)
    if (picked.length > 0) {
      formula = { ...formula, lineRatios: ratiosFromPicks(picked) }
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
