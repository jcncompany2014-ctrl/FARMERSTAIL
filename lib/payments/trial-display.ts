import { advanceTrialState, trialPricing, type TrialState } from './trial.ts'
import { DELIVERY_INTERVAL_DAYS } from '../personalization/cycle.ts'

/**
 * 어드민 구독 목록의 서포터즈 표시 — 구독별 "다음 결제 실제 금액".
 *
 * # 왜 (2026-10-01 사장님 캡처)
 * 서포터즈 고객 줄의 '회당 금액'이 정가(51,500원)로 떠서 실제 다음 결제(100원)와 달랐다.
 * subscriptions.total_amount 는 할인 전 금액이고, 서포터즈 가격은 청구하는 순간에만 적용된다.
 * "확실하게 구분감 있게" — 이 함수가 청구와 같은 판정(trialPricing)으로 실제 금액을 낸다.
 *
 * 한 사람의 서포터즈 회차는 구독 수와 무관하게 사용자 단위로 줄어든다. 청구 순서
 * (next_delivery_date → id, 활성만)상 k 번째 구독은 앞선 k 회차를 쓴 뒤의 가격이다
 * (lib/payments/auto-discount 미리보기와 같은 규칙 — advanceTrialState).
 * 순수 함수 — 화면·테스트가 같은 값을 쓴다.
 */
export type SupporterView = {
  phase: 'cheap' | 'half'
  /** 다음 결제 실제 금액. */
  chargeAmount: number
  /** 할인 전(정가) — 취소선용. */
  listAmount: number
  /** 이 구간에 남은 기간(일) — 회차가 아니라 기간으로 말한다(사장님 2026-10-01). */
  daysLeft: number
  caption: string
}

type SubLike = {
  id: string
  user_id: string
  status: string
  next_delivery_date: string | null
  total_amount: number
}

/** 서포터즈 혜택이 남아 있는가(100원·반값 구간 중 하나라도). */
export function isLiveTrial(t: TrialState | null | undefined): t is TrialState {
  return !!t && (t.cheap_remaining > 0 || t.half_remaining > 0)
}

export function supporterViews(
  subs: readonly SubLike[],
  trialsByUser: ReadonlyMap<string, TrialState>,
): Map<string, SupporterView> {
  const out = new Map<string, SupporterView>()
  const byUser = new Map<string, SubLike[]>()
  for (const s of subs) {
    if (s.status !== 'active' || !isLiveTrial(trialsByUser.get(s.user_id))) continue
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }
  for (const [userId, list] of byUser) {
    const base = trialsByUser.get(userId)!
    // 청구 순서 — 날짜 없는(카드 등록 전) 구독은 뒤로.
    const ordered = [...list].sort((a, b) => {
      const da = a.next_delivery_date ?? '9999-12-31'
      const db = b.next_delivery_date ?? '9999-12-31'
      return da === db ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : da < db ? -1 : 1
    })
    ordered.forEach((s, k) => {
      const state = advanceTrialState(base, k)
      const pricing = trialPricing(state, s.total_amount)
      if (!state || !pricing) return
      const remaining = pricing.phase === 'cheap' ? state.cheap_remaining : state.half_remaining
      const daysLeft = remaining * DELIVERY_INTERVAL_DAYS
      out.set(s.id, {
        phase: pricing.phase,
        chargeAmount: pricing.chargeAmount,
        listAmount: s.total_amount,
        daysLeft,
        caption:
          pricing.phase === 'cheap'
            ? `서포터즈 ${pricing.chargeAmount.toLocaleString('ko-KR')}원 구간 · ${daysLeft}일치 남음`
            : `서포터즈 반값 구간 · ${daysLeft}일치 남음`,
      })
    })
  }
  return out
}
