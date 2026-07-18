/**
 * 가격 SSOT — 최종 가격표 (2026-07-11, 사장님·동업자 확정 엑셀).
 *
 * # 구조
 * 500g 팩 **정가가 앵커**. 구독가 = 정가에서 15% 할인. 100g 환산:
 *
 *   | SKU  | 정가/100g | 구독가/100g | 500g 정가 |
 *   |------|----------|------------|----------|
 *   | 닭   | 4,800    | 4,080      | 24,000   |
 *   | 오리 | 5,400    | 4,590      | 27,000   |
 *   | 돼지 | 6,100    | 5,185      | 30,500   |
 *   | 소   | 8,300    | 7,055      | 41,500   |
 *
 * (2026-07-18 v4.0 마스터 레시피 원가계산 시트 앵커가격으로 갱신. 구 2026-07-11
 *  가격[20,500/24,000/27,000/38,500]은 페르소나 시트값이라 폐기.)
 *
 * # DB 와의 관계
 * `products.price` = 정가/100g, `products.sale_price` = 구독가/100g.
 * **청구는 전부 `sale_price ?? price`** (OrderClient·SubscribeClient) — 이 파일은
 * 결제 경로가 아니라 ①표시(정가 취소선→구독가) ②설문 퍼널의 일일 비용 추정에 쓴다.
 * 가격 변경 시 이 파일과 DB 를 함께 갱신할 것.
 *
 * # 배송비
 * 구독 배송비 = 전액 파머스테일 부담(고객 0원). 별도 배송비 시스템 없음.
 */
import type { ProteinKey } from './personalization/skuModel.ts'

export interface SkuPricing {
  /** 정가 (원/100g) — 500g 팩 정가 ÷ 5. 표시 앵커(취소선). */
  listPer100g: number
  /** 구독가 (원/100g) — 정가 −15%. 실제 청구 단가(= products.sale_price). */
  subPer100g: number
  /** 500g 팩 정가 (원) — 소비자 노출 앵커. */
  listPack500g: number
}

/** 구독 할인율 (정가 대비, %). */
export const SUBSCRIPTION_DISCOUNT_PCT = 15

export const SKU_PRICING: Record<Exclude<ProteinKey, 'salmon'>, SkuPricing> = {
  chicken: { listPer100g: 4800, subPer100g: 4080, listPack500g: 24000 },
  duck: { listPer100g: 5400, subPer100g: 4590, listPack500g: 27000 },
  pork: { listPer100g: 6100, subPer100g: 5185, listPack500g: 30500 },
  beef: { listPer100g: 8300, subPer100g: 7055, listPack500g: 41500 },
} as const

/**
 * 4종 구독가 평균 (원/100g) — 설문 퍼널 등 박스 구성 확정 전의 일일 비용 추정용.
 * (4080+4590+5185+7055)/4 = 5227.5 → 5228.
 */
export const AVG_SUB_KRW_PER_100G = 5228
