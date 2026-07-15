// /dogs/[id]/plan — 상품(플랜) 페이지 server wrapper (2026-07-13 사장님).
// 분석 결과(신뢰) 와 분리된 '전환' 전용 페이지 — 알고리즘 추천 레시피 + 안전한
// 자유선택(알레르기 잠금) + 화식 비율 + 첫박스 할인.
//
// ⚠️ formula 는 여기서 dog_formulas 를 직접 읽지 않는다 (2026-07-14 사장님
//    "분석은 닭 100% 인데 플랜은 다른 걸 추천"). 이전엔 최신 cycle 을 직접
//    읽어서 ①분석은 cycle 1, 플랜은 최신 cycle(2) ②분석은 계산 API 가 낡은
//    처방을 재계산하는데 플랜은 낡은 저장값 그대로 — 두 겹으로 어긋났다.
//    이제 PlanClient 가 분석과 동일하게 fetchComputedFormula(dogId, 1) 로
//    계산 API(cycle 1 read-or-create + stale 재계산)를 탄다 = 항상 일치.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]

  const [{ data: dog }, { data: subRows }, { data: prodList }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('name')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle(),
      // 이 강아지가 '진짜' 구독한 적 있는지 — 첫 박스 판정. 강아지별(다른
      // 강아지가 구독 중이어도 새 강아지는 첫 박스).
      // ⚠️ 카드 미등록·미결제 row 는 제외 — 배송지까지 갔다가 카드 등록에서
      //    취소하면 구독 row 만 남는데(2026-07-14 수정 전 생성분 포함), 그건
      //    첫 박스를 쓴 게 아니다. 카드 등록/결제/배송 중 하나라도 있어야 인정.
      supabase
        .from('subscriptions')
        .select('id')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .or(
          'billing_key.not.is.null,last_charged_at.not.is.null,total_deliveries.gt.0',
        )
        .limit(1),
      // 제품 map (slug → row) — 재고/구독 가능/가격 판정용.
      supabase
        .from('products')
        .select('slug, price, sale_price, stock, is_subscribable')
        .in('slug', allSlugs)
        .eq('is_active', true),
    ])

  if (!dog) redirect('/dogs')
  const dogName = (dog as { name: string }).name

  const products: Record<string, PlanProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as PlanProduct[]) {
    products[p.slug] = p
  }

  // 첫 박스 = 이 강아지의 '진짜' 구독 이력 없음. 50% 첫 박스 할인·'첫 박스'
  // 문구는 이때만 (사장님 2026-07-14) — 재구독 강아지는 구독가(정가 −15%).
  const isFirstBox = (subRows?.length ?? 0) === 0

  return (
    <PlanClient
      dogId={dogId}
      dogName={dogName}
      products={products}
      initialFresh={initialFresh}
      isFirstBox={isFirstBox}
    />
  )
}
