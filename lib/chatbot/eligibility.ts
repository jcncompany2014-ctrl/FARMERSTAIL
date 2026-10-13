/**
 * AI 상담을 쓸 수 있는 사람 — 순수 함수 (2026-10-13 사장님 결정, 규칙191).
 *
 * 사장님: 챗봇은 **정기배송 중인 견주만** 쓴다. 판정은 구독 상태 정본(subscriptionState)으로 —
 * 'active'(정기배송 중) 또는 'paused'(잠시 멈춤) 구독이 하나라도 있으면 허용한다.
 * 카드 미등록(needs_card)·결제 실패(card_failed)·해지(cancelled)만 있으면 허용하지 않는다.
 *
 * `@/` 값 import 없음 — node 테스트가 그대로 읽는다.
 */
import { subscriptionState, type SubLike } from '../subscription-state.ts'

/** API 가 403 과 함께 돌려주는 코드 — 화면이 이 코드로 안내 화면을 고른다. */
export const CHATBOT_SUBSCRIBERS_ONLY = 'SUBSCRIBERS_ONLY'

/** 안내 문구 — API·화면이 같은 말을 쓴다. */
export const CHATBOT_SUBSCRIBERS_ONLY_MESSAGE = 'AI 상담은 정기배송 중인 보호자님이 쓸 수 있어요'

export function canUseChatbot(subs: readonly SubLike[]): boolean {
  return subs.some((s) => {
    const st = subscriptionState(s)
    return st === 'active' || st === 'paused'
  })
}
