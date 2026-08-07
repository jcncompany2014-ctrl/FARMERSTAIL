import type { SupabaseClient } from '@supabase/supabase-js'
import type { Formula } from '@/lib/personalization/types'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  subscribableItems,
  priceForFormula,
} from '@/lib/personalization/boxPricing'
import {
  subscriptionItemRows,
  type ItemProduct,
  type SubscriptionItemRow,
} from '@/lib/personalization/subscriptionItems'

/**
 * 박스 견적 — **청구액과 품목을 같은 계산에서** 낸다.
 *
 * # 왜 꺼냈나 (2026-07-31)
 * `/api/personalization/approve` 의 `boxForApproved` 안에 있던 계산이다. 화식 비율
 * 변경 기능을 만들면서 **똑같은 계산이 한 번 더** 필요해졌다 — 비율만 다른 값으로.
 * 복사하면 금액을 만드는 곳이 둘이 되고, 그건 이 저장소가 반복해서 겪은 사고다
 * (청구는 created_at · 피킹은 cycle_number 로 서로 다른 처방을 집어 "긁은 금액과
 * 담는 박스가 다른" 상태가 됐던 것).
 *
 * ★ 금액과 품목이 **한 함수 한 입력**에서 나오는 게 핵심이다. 따로 계산하면
 *   "닭 값을 받고 소를 담는" 상태가 만들어진다(실제로 있었다 — 승인 후 청구액은
 *   새 처방, 주문내역은 옛 레시피).
 */

export type BoxQuote = {
  /** subscriptions.total_amount 에 들어갈 값. */
  total: number
  /** subscription_items 를 다시 만들 행들. */
  itemRows: SubscriptionItemRow[]
}

/**
 * 주어진 처방·화식 비율로 청구액과 품목을 낸다.
 *
 * 계산이 깨지면(제품 조회 실패·총액 0 이하) **null 을 돌려준다.** 호출부는
 * 그때 금액을 건드리지 않아야 한다 — 0원이나 음수로 덮어쓰느니 옛 값이 낫다.
 */
export async function quoteBox(
  // 읽기만 한다. 쿠키/service_role 어느 쪽이든 받는다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  input: {
    subscriptionId: string
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    dailyKcal: number
    /** 30 | 50 | 100. 0 이하면 계산하지 않는다. */
    freshRatio: number
  },
): Promise<BoxQuote | null> {
  if (!(input.freshRatio > 0)) return null

  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  // id·name·image_url 을 함께 받는다 — subscription_items 행을 만들 때 쓴다.
  const { data: prodList, error: prodErr } = await supabase
    .from('products')
    .select(
      'id, name, image_url, slug, price, sale_price, stock, is_subscribable, nutrition_facts',
    )
    .in('slug', allSlugs)
    .eq('is_active', true)
  if (prodErr) {
    console.error('[boxQuote] 제품 조회 실패:', prodErr.message)
    return null
  }
  const products: Record<string, ItemProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as ItemProduct[]) {
    products[p.slug] = p
  }
  if (Object.keys(products).length === 0) return null

  const calcInput = {
    formula: {
      lineRatios: input.formula.lineRatios,
      toppers: input.formula.toppers,
      dailyKcal: input.dailyKcal,
    },
    freshRatio: input.freshRatio,
    products,
  }
  const { total } = priceForFormula(calcInput)
  // 0원/음수가 나오면 계산이 깨진 것 — 청구액을 망가뜨리느니 그대로 둔다.
  // ★`> 0` 만으로는 Infinity 를 못 막는다(`Infinity > 0` 은 참). 금액 가드는
  //  유한성까지 본다 (2026-08-08 금액 감사).
  if (!Number.isFinite(total) || total <= 0) return null

  // 같은 입력으로 품목도 만든다 — 금액과 내용물이 같은 계산에서 나와야 한다.
  const items = subscribableItems(computeBoxItems(calcInput))
  return {
    total,
    itemRows: subscriptionItemRows(input.subscriptionId, items),
  }
}
