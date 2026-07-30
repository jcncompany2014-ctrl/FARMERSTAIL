import type { BoxItem, BoxProduct } from './boxPricing.ts'

/**
 * `subscription_items` 행 만들기 — **가입과 처방 승인이 같은 함수를 쓴다.**
 *
 * # 왜 필요한가 (2026-07-30 감사)
 * `subscription_items` 는 저장소 전체에서 **insert 만 있었고 update 가 한 곳도
 * 없었다.** 그래서 처방을 승인해 레시피가 바뀌어도 이 표는 가입 시 값에 그대로
 * 멈춰 있었다. 그런데 이 표를 읽는 곳이 9군데다(마이페이지·강아지 구독 탭·
 * 대시보드·웹 구독·admin 목록·admin 캘린더·재고 예측 …), 게다가 청구 크론이
 * 이걸 **`order_items` 로 복사**한다 — 즉 주문 원장에 남는 품목이기도 하다.
 *
 * 승인 후 실제로 벌어지던 일:
 *   · 실제 포장(피킹 리스트) = dog_formulas + boxPricing → **새 처방** ✔
 *   · 청구액(subscriptions.total_amount)  = 승인 시 갱신 → **새 금액** ✔
 *   · 화면 9곳 · 주문내역(order_items)     = subscription_items → **옛 레시피** ✘
 * 고객은 닭고기를 승인하고 닭고기 값을 내고 닭고기를 받는데, 주문내역에는
 * 소고기가 적혀 있었다. 문의가 오면 우리도 뭐가 맞는지 알 수 없다.
 *
 * # 정본 관계
 * 박스 내용의 정본은 **처방(dog_formulas) + boxPricing** 이고,
 * `subscription_items` 는 그 **파생 스냅샷**이다. 처방이 바뀌면 다시 만든다.
 * 두 곳에서 각자 만들면 또 갈라지므로 행 모양을 여기 한 곳에 둔다.
 */

/** subscription_items 한 행. product_id 는 NOT NULL 이라 null 인 항목은 제외된다. */
export type SubscriptionItemRow = {
  subscription_id: string
  product_id: string
  quantity: number
  unit_price: number
  product_name: string
  product_image_url: string | null
}

/** 행을 만들려면 product 에 이만큼이 필요하다(가격 계산용 BoxProduct + 표시용). */
export type ItemProduct = BoxProduct & {
  id: string
  name: string
  image_url: string | null
}

/**
 * 화면에 쓰는 품목명 — "한우 (165g 한 끼)" / "채소 토퍼 (100g 팩)".
 *
 * 메인 라인은 **한 끼 분량**으로, 토퍼는 **팩 g** 으로 쓴다. 토퍼는 하루에
 * 뿌리는 양이라 '한 끼'라고 하면 틀린 말이 된다.
 */
export function itemDisplayName(item: BoxItem<ItemProduct>): string {
  const portionTag = item.line ? `${item.mealG}g 한 끼` : `${item.packG}g 팩`
  return `${item.product.name} (${portionTag})`
}

/**
 * BoxItem 목록 → subscription_items 행 목록.
 *
 * `unit_price` 는 **표시 단가**(`pricePerPack`)다 — 청구는 `total_amount`(라인
 * 최종가 합)로 하고, 이 표는 "한 팩 얼마"를 보여주는 데 쓴다. boxPricing 의
 * 주석대로 pricePerPack 으로 합산하면 10원 올림이 누적돼 총액이 어긋나므로
 * **이 값으로 다시 합계를 만들지 말 것.**
 */
export function subscriptionItemRows(
  subscriptionId: string,
  items: BoxItem<ItemProduct>[],
): SubscriptionItemRow[] {
  return items.map((it) => ({
    subscription_id: subscriptionId,
    product_id: it.product.id,
    quantity: it.quantity,
    unit_price: it.pricePerPack,
    product_name: itemDisplayName(it),
    product_image_url: it.product.image_url,
  }))
}
