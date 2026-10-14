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
import type { ProjectedRound } from '../payments/charge-projection.ts'
import type { PricePhase } from '../payments/price-rise.ts'

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
 *
 * @deprecated 2026-10-15(규칙272) — '지금 구간'을 남은 회차로만 정해 마지막으로 결제한 구간(lastPaidPhase)을 모른다. 인상 직전
 *   2주 동안 인상을 놓친다. 이번 주 할 일·브리핑은 trialTransitionsFromRounds(청구·체험단 화면과 같은 회차 펼치기)를 쓴다.
 *   새 코드에서 부르지 말 것(규칙249 테스트의 회차 계산 예시로만 남겨 둔다).
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

/**
 * 서포터즈마다 다음 가격 전환 — **청구와 체험단 화면이 쓰는 회차 펼치기(projectUserRounds · loadChargeProjection)의 결과**에서
 * 처음으로 값이 오르는 회차를 고른다 (2026-10-15 F-b, 규칙272). 이번 주 할 일·아침 브리핑은 이 함수를 쓴다.
 *
 * # 왜(nextTrialTransitions 의 구멍)
 * nextTrialTransitions 는 '지금 구간'을 **남은 회차로만** 정했다. 그런데 청구 크론은 '바로 앞에 결제된 회차의 구간'(lastPaidPhase)과
 * 이번 회차를 비교해 인상을 정한다(priceRiseGate). 마지막 100원 결제(11/17) 뒤엔 남은 100원이 0 이라 '지금 = 반값'으로 읽혀
 * 12/1 반값 인상과 그 동의 없음을 놓쳤고(11/18), 마지막 반값 결제(1/12) 뒤엔 '지금 = 정가'로 읽혀 1/23 정가 인상 자체를 놓쳤다(1/13).
 * 정작 급한 인상 직전 2주 동안 할 일·브리핑이 조용했다.
 *
 * rounds 는 그 사람의 회차 일정(동의를 받는다고 보고 끝까지 — stopAtHold:false, 체험단 화면과 같은 펼치기).
 * 인상 회차의 앞 구간 = 일정의 앞 회차, 없으면(다음 결제가 곧 인상) 마지막으로 결제한 구간(lastPaidPhase).
 */
export function trialTransitionsFromRounds(
  users: ReadonlyArray<{
    userId: string
    rounds: readonly ProjectedRound[]
    trial: TrialState | null
    lastPaidPhase: PricePhase | null
  }>,
  dogBySub: ReadonlyMap<string, string | null>,
): TrialTransition[] {
  const out: TrialTransition[] = []
  for (const u of users) {
    // 체험 도장이 없는 사람(정상가 고객)은 인상 판정 대상이 아니다 — 청구 크론과 같다.
    if (!u.trial) continue
    const idx = u.rounds.findIndex((r) => r.rise !== null)
    if (idx < 0) continue
    const r = u.rounds[idx]!
    const prevPhase: PricePhase | null = idx > 0 ? u.rounds[idx - 1]!.phase : u.lastPaidPhase
    // 인상 = 앞 구간보다 높은 구간 — 앞 구간은 100원·반값뿐이다.
    if (prevPhase !== 'cheap' && prevPhase !== 'half') continue
    // 앞 금액 — 일정에 앞 회차가 있으면 그 금액, 없으면 마지막으로 결제한 구간의 금액(같은 정본 trialPricing).
    const prevState: TrialState =
      prevPhase === 'cheap'
        ? { ...u.trial, cheap_remaining: 1, half_remaining: 0 }
        : { ...u.trial, cheap_remaining: 0, half_remaining: 1 }
    const fromAmount = idx > 0 ? u.rounds[idx - 1]!.chargeAmount : (trialPricing(prevState, r.listAmount)?.chargeAmount ?? r.listAmount)
    const full = u.rounds.find((x) => x.phase === 'full') ?? null
    out.push({
      userId: u.userId,
      subscriptionId: r.subId,
      dogId: dogBySub.get(r.subId) ?? null,
      phase: prevPhase,
      nextPhase: r.rise === 'to_half' ? 'half' : 'full',
      shipIso: r.shipIso,
      chargeIso: r.chargeIso,
      fromAmount,
      toAmount: r.chargeAmount,
      fullChargeIso: full ? full.chargeIso : null,
    })
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
