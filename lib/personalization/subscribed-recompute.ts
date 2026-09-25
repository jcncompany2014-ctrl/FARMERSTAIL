/**
 * 구독 중인 강아지의 **적용 중 처방**을 재설문 재계산이 덮어도 되는가
 * (2026-09-25 출시 전 점검 3차).
 *
 * # 무슨 일이 있었나
 * `/api/personalization/compute` 는 최신 분석이 처방보다 새로우면 cycle 1 을 다시
 * 계산해 **덮어쓴다**(임상 안전 — 새 알레르기 반영). 그런데 구독 중인 강아지도 예외가
 * 없었다. '정확도 올리기'나 체중 변경으로 재설문하면:
 *   · 피킹 리스트(dog_formulas 를 읽는다)는 **새 레시피·새 그램**을 포장하고
 *   · 청구는 옛 total_amount, 주문 품목은 옛 subscription_items 그대로
 * → 고객 동의 없이 박스 내용이 바뀌고 금액과 어긋났다. 같은 위험을 adjust 라우트는
 *   SUBSCRIBED_LOCKED 로 이미 막고 있었다(구독 중 구성 변경 = 재제안 승인 경유).
 *
 * # 판정
 *  - 구독 없음 → 종전대로 덮는다(가입 전 미세조정).
 *  - 구독 중인데 **지금 포장 중인 라인이 새 알레르기와 겹친다** → 덮는다.
 *    다음 재제안(박스 3개마다)까지 기다리면 알레르기 성분이 그대로 나간다 — 안전이
 *    금액 정합보다 먼저다. 대신 호출부가 error 로 남겨 사장님이 금액을 맞추게 한다.
 *  - 구독 중인데 새 계산이 **상담 필요**(판매 레시피 전부 부적합·임상 게이트) → 덮는다
 *    (같은 이유 — 저장 정본에 상담 플래그가 실려야 주문·플랜이 멈춘다).
 *  - 그 밖(체중·활동·선호 변화) → **덮지 않는다.** 재제안·금액 동의 경로가 다음
 *    제안 때 반영한다(lib/personalization/cycle, PriceChangeConsentModal).
 */
import { LEGACY_LINE_TO_PROTEIN, SKU_MODEL } from './skuModel.ts'
import type { FoodLine } from './types.ts'

export type SubscribedRecomputeInput = {
  hasLiveSubscription: boolean
  /** 지금 저장·포장 중인 cycle 1 의 lineRatios. */
  appliedLineRatios: Partial<Record<FoodLine, number>>
  /** 최신 설문의 선언 알레르기. */
  newAllergies: readonly string[]
  /** 새 계산 결과가 상담 필요로 판정됐나. */
  newNeedsConsultation: boolean
}

export type SubscribedRecomputeDecision =
  | { overwrite: true; reason: 'no_subscription' | 'allergy_conflict' | 'needs_consultation' }
  | { overwrite: false; reason: 'deferred_to_proposal' }

/** 적용 중 라인 중 새 알레르기의 차단 성분과 겹치는 게 있나. */
export function appliedLinesConflictWithAllergies(
  appliedLineRatios: Partial<Record<FoodLine, number>>,
  allergies: readonly string[],
): boolean {
  return (Object.keys(appliedLineRatios) as FoodLine[]).some((l) => {
    if (!((appliedLineRatios[l] ?? 0) > 0)) return false
    const protein = LEGACY_LINE_TO_PROTEIN[l as keyof typeof LEGACY_LINE_TO_PROTEIN]
    const model = protein ? SKU_MODEL[protein] : undefined
    if (!model) return false
    return model.blockingAllergies.some((b) => allergies.includes(b))
  })
}

export function subscribedRecomputeDecision(
  input: SubscribedRecomputeInput,
): SubscribedRecomputeDecision {
  if (!input.hasLiveSubscription) return { overwrite: true, reason: 'no_subscription' }
  if (appliedLinesConflictWithAllergies(input.appliedLineRatios, input.newAllergies)) {
    return { overwrite: true, reason: 'allergy_conflict' }
  }
  if (input.newNeedsConsultation) return { overwrite: true, reason: 'needs_consultation' }
  return { overwrite: false, reason: 'deferred_to_proposal' }
}
