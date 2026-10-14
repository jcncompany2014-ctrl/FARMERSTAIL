import { advanceTrialState, trialPricing, type TrialState } from './trial.ts'
import {
  chargeDateFor,
  chargeTimingFor,
  nextChargeDateAfterSuccess,
  type ChargeTiming,
} from '../shipping-schedule.ts'
import {
  activeConsentFor,
  phaseOf,
  priceRiseBetween,
  type PriceConsentRow,
  type PricePhase,
  type PriceRise,
} from './price-rise.ts'

/**
 * 앞으로의 결제 회차 펼치기 — 어드민 '체험단 일정표'·'다가오는 결제'·포장 목록 '결제 예정액'이 같은 함수를 쓴다
 * (2026-10-14 A1·A2).
 *
 * # 손 계산 금지 — 전부 정본 함수를 부른다
 *  · 결제일 = chargeDateFor(발송일, chargeTimingFor(그 회차의 체험 상태)) — 청구 크론과 같다.
 *  · 다음 발송일 = nextChargeDateAfterSuccess(발송일, 결제일, 결제 시점) — 청구 크론이 결제 성공 뒤 쓰는 함수.
 *  · 체험 금액 = trialPricing(advanceTrialState(체험 상태, k), 구독가) — resolveAutoDiscount 가 체험 구간에서 쓰는 그 식.
 *  · 정가 구간 금액 = 호출부가 resolveAutoDiscount 로 구해 넘긴다(DB 가 필요 — 등급·이벤트·이웃 할인).
 *    first = 그 사람의 첫 정가 회차(이벤트 할인처럼 한 번만 붙는 것 포함), recurring = 그 뒤 반복 금액.
 *  · 인상 회차·보류 = priceRiseGate 와 같은 판정(priceRiseBetween + activeConsentFor).
 *
 * # 순서
 * 한 사람의 체험 회차는 구독 수와 무관하게 사람 단위로 준다 — 청구 크론의 처리 순서(발송일 → 구독 id)대로 회차를
 * 펼치고, k 번째 회차는 앞선 k 회차를 쓴 뒤의 상태로 판정한다(lib/payments/trial-display 와 같은 규칙).
 *
 * # 보류(stopAtHold)
 * 실제로 나갈 돈을 볼 때(다가오는 결제·포장 목록)는 보류될 회차에서 그 구독을 멈춘다 — 동의가 기록될 때까지 청구 크론이
 * 그 회차를 넘기지 않기 때문이다(회차도 안 줄고 발송일도 안 민다). 일정표(체험단 화면)는 동의를 받는다고 보고 끝까지 펼친다.
 */

export type ProjectionSub = { id: string; next_delivery_date: string | null; total_amount: number }
export type ProjectedPrice = { amount: number; label: string | null }
export type FullPrices = { first: ProjectedPrice; recurring: ProjectedPrice }

export type ProjectedRound = {
  subId: string
  /** 이 사람의 몇 번째 결제인가(0 = 다음 결제) — 앞선 결제 수. */
  k: number
  /** 박스 발송일(화). */
  shipIso: string
  /** 실제로 결제될 날 — 정해진 결제일이 이미 지났으면 다음 청구 크론이 도는 날. */
  chargeIso: string
  /** 정해진 결제일(chargeDateFor). */
  scheduledChargeIso: string
  /** 정해진 결제일이 이미 지났다(재시도·따라잡기). */
  late: boolean
  timing: ChargeTiming
  phase: PricePhase
  /** 할인 전 구독가. */
  listAmount: number
  /** 실제로 나갈 금액. */
  chargeAmount: number
  label: string | null
  /** 가격이 오르는 회차인가. */
  rise: PriceRise | null
  /** 인상 회차인데 동의 기록이 없다 — 청구 크론이 보류한다. */
  held: boolean
}

export function projectUserRounds(input: {
  subs: readonly ProjectionSub[]
  trial: TrialState | null
  /** 바로 앞에 결제된 회차의 가격 구간 — 없으면(첫 결제) null. */
  lastPaidPhase: PricePhase | null
  consents: readonly PriceConsentRow[]
  fullPriceBySub: ReadonlyMap<string, FullPrices>
  /** 다음 청구 크론이 도는 날(KST) — 지난 결제일은 이 날로 본다(nextChargeRunDate). */
  fromIso: string
  /** 이 날(포함)까지의 결제만 펼친다. */
  untilChargeIso: string
  stopAtHold: boolean
  /** 안전 상한(사람당). */
  maxRounds?: number
}): ProjectedRound[] {
  const max = input.maxRounds ?? 60
  const cursor = new Map<string, string>()
  const subById = new Map<string, ProjectionSub>()
  for (const s of input.subs) {
    if (!s.next_delivery_date) continue
    cursor.set(s.id, s.next_delivery_date.slice(0, 10))
    subById.set(s.id, s)
  }
  const out: ProjectedRound[] = []
  let k = 0
  let prevPhase: PricePhase | null = input.lastPaidPhase
  let firstFullUsed = false
  while (out.length < max && cursor.size > 0) {
    // 청구 크론의 처리 순서 — 발송일 → 구독 id.
    let pickId: string | null = null
    let pickShip = ''
    for (const [id, ship] of cursor) {
      if (pickId === null || ship < pickShip || (ship === pickShip && id < pickId)) {
        pickId = id
        pickShip = ship
      }
    }
    if (pickId === null) break
    const sub = subById.get(pickId)!
    const state = input.trial ? advanceTrialState(input.trial, k) : null
    const timing = chargeTimingFor(state)
    const scheduled = chargeDateFor(pickShip, timing)
    const chargeIso = scheduled < input.fromIso ? input.fromIso : scheduled
    if (chargeIso > input.untilChargeIso) {
      // 이 구독의 다음 회차는 더 뒤다 — 펼치기 끝.
      cursor.delete(pickId)
      continue
    }
    const phase: PricePhase = (input.trial ? phaseOf(state) : null) ?? 'full'
    const rise = input.trial ? priceRiseBetween(prevPhase, phase) : null
    const held = rise !== null && !activeConsentFor(input.consents, rise)

    let price: ProjectedPrice
    const trialPrice = phase === 'full' ? null : trialPricing(state, sub.total_amount)
    if (trialPrice) {
      price = { amount: trialPrice.chargeAmount, label: trialPrice.label }
    } else {
      const fp = input.fullPriceBySub.get(sub.id)
      price = (fp ? (firstFullUsed ? fp.recurring : fp.first) : null) ?? {
        amount: sub.total_amount,
        label: null,
      }
    }

    out.push({
      subId: sub.id,
      k,
      shipIso: pickShip,
      chargeIso,
      scheduledChargeIso: scheduled,
      late: scheduled < input.fromIso,
      timing,
      phase,
      listAmount: sub.total_amount,
      chargeAmount: price.amount,
      label: price.label,
      rise,
      held,
    })

    if (held && input.stopAtHold) {
      // 청구 크론이 이 회차를 넘기지 않는다 — 회차도 안 줄고 발송일도 안 민다. 이 구독의 뒤 회차는 없다.
      cursor.delete(pickId)
      continue
    }
    if (phase === 'full') firstFullUsed = true
    prevPhase = phase
    k += 1
    cursor.set(pickId, nextChargeDateAfterSuccess(pickShip, chargeIso, timing))
  }
  return out
}

/** 결제일별로 묶기 — 화면용. 보류 회차는 합계에서 뺀다(나가지 않는 돈). */
export function groupRoundsByChargeDate<R extends ProjectedRound>(
  rounds: readonly R[],
): Array<{ chargeIso: string; rounds: R[]; chargeTotal: number; listTotal: number; heldCount: number }> {
  const byDay = new Map<string, R[]>()
  for (const r of rounds) {
    const arr = byDay.get(r.chargeIso) ?? []
    arr.push(r)
    byDay.set(r.chargeIso, arr)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([chargeIso, rs]) => ({
      chargeIso,
      rounds: rs,
      chargeTotal: rs.filter((r) => !r.held).reduce((s, r) => s + r.chargeAmount, 0),
      listTotal: rs.filter((r) => !r.held).reduce((s, r) => s + r.listAmount, 0),
      heldCount: rs.filter((r) => r.held).length,
    }))
}
