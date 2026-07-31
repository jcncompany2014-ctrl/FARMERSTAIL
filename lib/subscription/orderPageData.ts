import { createClient } from '@/lib/supabase/server'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { ALL_LINES } from '@/lib/personalization/lines'
import { ratiosFromPicks, MAX_PICKS } from '@/lib/personalization/boxPicks'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'

/**
 * 구독 신청 화면의 **서버 데이터 준비** — 앱·웹이 같이 쓴다.
 *
 * # 왜 꺼냈나 (2026-07-31)
 * 사장님 지시로 **웹에서도 구독 신청**이 되게 만드는 중이다. 앱 화면
 * (`app/(main)/dogs/[id]/order`)은 서버 206줄이 전부 데이터 준비였고, 웹 페이지를
 * 새로 만들면 그걸 통째로 복사하게 된다. 그런데 여기 담긴 것들은 **전부 과거에
 * 사고가 났던 지점**이다:
 *   · cycle 1 고정 (최신 cycle 을 읽어 "닭으로 추천받고 오리를 받는" 사고)
 *   · needsConsultation 안전 게이트 (알레르기 박스가 결제까지 간 사고)
 *   · `?recipes=` 반영 (플랜에서 고른 레시피가 주문 화면에서 사라진 사고)
 *   · pickedRecipes 를 클라이언트로 내려보내기 (생성 라우트가 같은 비율을
 *     재현하지 못해 금액 검산에서 거부되던 사고)
 * 복사본이 생기면 **한쪽만 고쳐지는 순간 이 사고들이 그쪽에서 부활한다.**
 * 오늘만 그 부류(같은 규칙이 두 곳에 살다 한쪽만 고쳐짐)를 네 번 고쳤다.
 *
 * # 화면은 안 옮긴다
 * 여기는 **데이터만** 만든다. 어디로 돌려보낼지(redirect 목적지)는 앱·웹이
 * 다르므로 결과를 돌려주고 호출부가 정한다 — 로더가 목적지를 알면 그것도
 * 두 곳으로 갈라진다.
 */

export type OrderProductRow = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  stock: number
  net_weight_g: number | null
  is_subscribable: boolean | null
  nutrition_facts: unknown
}

export type OrderProfileShape = {
  name: string
  phone: string
  zip: string
  address: string
  address_detail: string
  prefilled: boolean
}

export type OrderPageData =
  | { ok: false; reason: 'unauthenticated' }
  /** 내 강아지가 아니거나 없음. */
  | { ok: false; reason: 'dog_not_found' }
  /** 판매 레시피가 전부 알레르기 — 결제로 넘기면 안 된다. 분석/상담으로. */
  | { ok: false; reason: 'needs_consultation' }
  | {
      ok: true
      userId: string
      dogName: string
      /** null 이면 처방이 아직 없다 — 클라이언트가 안내 CTA 를 그린다. */
      formula: Formula | null
      products: Record<string, OrderProductRow>
      profile: OrderProfileShape
      initialFresh: 30 | 50 | 100
      pickedRecipes: FoodLine[]
    }

export async function loadOrderPageData(
  dogId: string,
  sp: { fresh?: string; recipes?: string },
): Promise<OrderPageData> {
  // 분석 카드 CTA 가 넘겨준 화식 비율(?fresh=30|50|100) → 초기 선택.
  const freshParam = Number(sp.fresh)
  const initialFresh: 30 | 50 | 100 =
    freshParam === 50 ? 50 : freshParam === 100 ? 100 : 30

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

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

  if (!dog) return { ok: false, reason: 'dog_not_found' }
  const dogName = (dog as { name: string }).name

  // formula null 일 때는 client 가 empty CTA 노출 — 여기서 막지 않는다.
  let formula: Formula | null = null
  /** 플랜에서 고른 레시피 — 생성 라우트가 같은 비율을 재현하는 데 쓴다. */
  let pickedRecipes: FoodLine[] = []
  if (formulaRow) {
    // audit #79: dog_formulas formula/reasoning 컬럼은 jsonb — generated type
    // 보다 코드 모델이 더 정확.
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
    // 결제로 못 넘어간다 (2026-07-24: 이 게이트 없으면 알레르기 성분 박스가
    // 결제까지 갔다). 어디로 돌려보낼지는 호출부가 정한다.
    if (f.formula.needsConsultation) {
      return { ok: false, reason: 'needs_consultation' }
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
    // ★ 고른 목록을 클라이언트로도 내려보낸다 — 구독 생성 라우트가 **같은 변환**을
    //   다시 해야 하기 때문이다. 서버가 알고리즘 원본 비율로 계산하면 금액이
    //   달라져 검산에서 거부되고, 플랜에서 레시피를 고른 고객은 가입 자체가
    //   막힌다(2026-07-30 점검에서 발견).
    pickedRecipes = picked
  }

  // products map (slug → row). formula 없으면 client 가 안내문만 노출 — fetch skip.
  let products: Record<string, OrderProductRow> = {}
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
    const map: Record<string, OrderProductRow> = {}
    for (const p of ((prodList ?? []) as unknown) as OrderProductRow[]) {
      map[p.slug] = p
    }
    products = map
  }

  const profile: OrderProfileShape = prof
    ? (() => {
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
    : {
        name: '',
        phone: '',
        zip: '',
        address: '',
        address_detail: '',
        prefilled: false,
      }

  return {
    ok: true,
    userId: user.id,
    dogName,
    formula,
    products,
    profile,
    initialFresh,
    pickedRecipes,
  }
}
