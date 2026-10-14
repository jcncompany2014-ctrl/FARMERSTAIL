/**
 * 서포터즈 다음 가격 전환 — 순수 함수 (2026-10-14 어드민 B2, 규칙249).
 *
 * 청구와 같은 판정만 쓴다: 회차 차감 순서 = advanceTrialState(100원 → 반값 → 정가), 금액 = trialPricing,
 * 결제일 = chargeDateFor(chargeTimingFor) — 서포터즈 구간은 발송일(화), 정가부터는 발송 3일 전 토요일.
 * 한 사람의 회차는 구독 수와 무관하게 사용자 단위로 줄어든다(trial-display supporterViews 와 같은 청구 순서: 발송일 → id).
 *
 * 예(운영 6명, 2026-10-14): 남은 100원 3회 → 10/20·11/3·11/17 100원, 12/1 첫 반값, 2027-01-26 발송분부터 정가(1/23 토 결제).
 */
import { advanceTrialState, trialPricing, type TrialState } from '../payments/trial.ts'
import { addDaysKst, diffDaysKst } from '../datetime-kst.ts'
import { chargeDateFor, chargeTimingFor } from '../shipping-schedule.ts'

export type TrialPhaseNow = 'cheap' | 'half' | 'full'

export type TrialTransition = {
  userId: string
  subscriptionId: string
  dogId: string | null
  /** 지금 구간. */
  phase: 'cheap' | 'half'
  /** 바뀌는 구간. */
  nextPhase: 'half' | 'full'
  /** 가격이 바뀌는 박스의 발송일·결제일. */
  shipIso: string
  chargeIso: string
  /** 지금 구간의 다음 결제 금액 → 바뀐 뒤 금액. 정가는 할인 전 구독가(등급 할인은 결제 때 따로). */
  fromAmount: number
  toAmount: number
  /** 정가가 시작되는 결제일(이번 전환이 반값이면 그다음 전환). */
  fullChargeIso: string | null
}

type SubLike = {
  id: string
  user_id: string
  dog_id: string | null
  status: string
  next_delivery_date: string | null
  total_amount: number
}

function phaseOf(s: TrialState | null): TrialPhaseNow {
  if (s && s.cheap_remaining > 0) return 'cheap'
  if (s && s.half_remaining > 0) return 'half'
  return 'full'
}

/** 사용자의 다가오는 결제를 청구 순서로(발송일 → 구독 id) — 회차 차감 순서와 같다. */
function upcomingCharges(subs: readonly SubLike[], horizon: number): Array<{ sub: SubLike; shipIso: string }> {
  const out: Array<{ sub: SubLike; shipIso: string }> = []
  for (const s of subs) {
    if (!s.next_delivery_date) continue
    for (let p = 0; p < horizon; p++) out.push({ sub: s, shipIso: addDaysKst(s.next_delivery_date, 14 * p) })
  }
  return out.sort((a, b) =>
    a.shipIso === b.shipIso ? (a.sub.id < b.sub.id ? -1 : a.sub.id > b.sub.id ? 1 : 0) : a.shipIso < b.shipIso ? -1 : 1,
  )
}

/**
 * 서포터즈마다 다음 가격 전환 하나(지금 구간이 끝나고 처음 바뀌는 결제). 활성 구독·남은 회차가 있는 사람만.
 * 결과는 결제일 순.
 */
export function nextTrialTransitions(
  subs: readonly SubLike[],
  trialsByUser: ReadonlyMap<string, TrialState>,
): TrialTransition[] {
  const byUser = new Map<string, SubLike[]>()
  for (const s of subs) {
    if (s.status !== 'active' || !s.next_delivery_date) continue
    const base = trialsByUser.get(s.user_id)
    if (phaseOf(base ?? null) === 'full') continue
    const list = byUser.get(s.user_id) ?? []
    list.push(s)
    byUser.set(s.user_id, list)
  }
  const out: TrialTransition[] = []
  for (const [userId, list] of byUser) {
    const base = trialsByUser.get(userId)!
    const total = base.cheap_remaining + base.half_remaining
    const horizon = Math.ceil((total + 2) / Math.max(1, list.length)) + 1
    const seq = upcomingCharges(list, horizon)
    const now = phaseOf(base) as 'cheap' | 'half'
    let found: TrialTransition | null = null
    let fullChargeIso: string | null = null
    seq.forEach((c, k) => {
      const state = advanceTrialState(base, k)
      const ph = phaseOf(state)
      if (ph === 'full' && fullChargeIso === null) fullChargeIso = chargeDateFor(c.shipIso, chargeTimingFor(state))
      if (found || ph === now) return
      const first = advanceTrialState(base, 0)
      const fromAmount = trialPricing(first, seq[0]!.sub.total_amount)?.chargeAmount ?? seq[0]!.sub.total_amount
      const toAmount = ph === 'full' ? c.sub.total_amount : (trialPricing(state, c.sub.total_amount)?.chargeAmount ?? c.sub.total_amount)
      found = {
        userId,
        subscriptionId: c.sub.id,
        dogId: c.sub.dog_id,
        phase: now,
        // 차감 순서가 100원 → 반값 → 정가라 지금과 다른 구간은 반값·정가뿐이다.
        nextPhase: ph === 'full' ? 'full' : 'half',
        shipIso: c.shipIso,
        chargeIso: chargeDateFor(c.shipIso, chargeTimingFor(state)),
        fromAmount,
        toAmount,
        fullChargeIso: null,
      }
    })
    if (found) out.push({ ...(found as TrialTransition), fullChargeIso })
  }
  return out.sort((a, b) => (a.chargeIso < b.chargeIso ? -1 : a.chargeIso > b.chargeIso ? 1 : 0))
}

export const TRIAL_PHASE_LABEL: Record<TrialPhaseNow, string> = {
  cheap: '100원',
  half: '반값',
  full: '정가',
}

/**
 * 가격 인상 동의(A 갈래 표 subscription_price_consents — 마이그 20261014200000) — 이번 주 할 일·브리핑용.
 *
 * 인상 이름은 A 갈래 정본(lib/payments/price-rise PriceRise)과 같다: 100원 → 반값 = to_half, 정가로 오르는 것은
 * (반값을 거치든 100원에서 바로든) to_full. 유효한 기록 = revoked_at 이 비어 있는 것(한 사람·한 인상에 하나).
 * 기록이 없는 인상 회차는 청구 크론이 결제를 보류한다(A 갈래) — 그래서 사장님이 결제일 전에 받아 둬야 한다.
 * 빨간색 기준 30일 = A 갈래 CONSENT_RED_DAYS(증액 사전 고지·동의 기간)와 같은 값. 합칠 때 그쪽 consentStatus 로 바꿔도 된다.
 */
export type TrialConsentRise = 'to_half' | 'to_full'

export type TrialConsentRow = {
  user_id: string
  rise: string
  consented_on: string
  channel: string
  revoked_at: string | null
}

export const TRIAL_CONSENT_RED_DAYS = 30

export const TRIAL_CONSENT_CHANNEL_LABEL: Record<string, string> = {
  instagram_dm: '인스타 DM',
  kakao: '카카오톡',
  sms: '문자',
  phone: '전화',
  email: '메일',
  in_person: '직접 만나서',
  other: '기타',
}

export function consentRiseOf(t: Pick<TrialTransition, 'nextPhase'>): TrialConsentRise {
  return t.nextPhase === 'half' ? 'to_half' : 'to_full'
}

export type TrialConsentState =
  | { status: 'recorded'; rise: TrialConsentRise; consentedOn: string; channel: string }
  | { status: 'urgent' | 'waiting'; rise: TrialConsentRise; daysLeft: number }

/**
 * 전환 하나의 동의 상태 — recorded(유효 기록 있음) · urgent(없음 + 결제일 30일 안·지남) · waiting(없음, 아직 멂).
 * consents 는 그 사람의 기록 전부(취소된 것 포함해도 된다 — 여기서 거른다).
 */
export function trialConsentState(
  t: Pick<TrialTransition, 'userId' | 'nextPhase' | 'chargeIso'>,
  consents: readonly TrialConsentRow[],
  todayIso: string,
): TrialConsentState {
  const rise = consentRiseOf(t)
  const hit = consents.find((c) => c.user_id === t.userId && c.rise === rise && !c.revoked_at)
  if (hit) return { status: 'recorded', rise, consentedOn: hit.consented_on, channel: hit.channel }
  const daysLeft = diffDaysKst(t.chargeIso, todayIso)
  return { status: daysLeft <= TRIAL_CONSENT_RED_DAYS ? 'urgent' : 'waiting', rise, daysLeft }
}
