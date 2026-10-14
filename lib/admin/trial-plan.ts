import {
  activeConsentFor,
  consentStatus,
  PRICE_RISE_LABEL,
  type PriceConsentRow,
  type PriceRise,
} from '../payments/price-rise.ts'
import type { ProjectedRound } from '../payments/charge-projection.ts'

/**
 * 어드민 체험단 화면의 사람별 요약 — 순수 함수(2026-10-14 A1).
 *
 * 회차 일정표(projectUserRounds 결과)와 동의 기록으로 '다음 결제 · 다음 가격 전환일 · 인상별 동의 상태'를 만든다.
 * 금액·날짜는 전부 일정표(정본 함수로 펼친 값)에서 그대로 가져온다 — 여기서 다시 계산하지 않는다.
 */

export type RiseView = {
  rise: PriceRise
  label: string
  /** 그 인상이 일어나는 회차 — 이미 지났거나(앞 회차가 이미 그 구간) 이 계획에 없으면 null. */
  round: { chargeIso: string; shipIso: string; amount: number; prevAmount: number | null } | null
  /** recordedBy = 기록한 관리자(auth.users.id) — 이름은 화면이 프로필로 붙인다. */
  consent: { id: string; consentedOn: string; channel: string; memo: string; recordedBy: string | null } | null
  /** recorded = 받음 · urgent = 아직(30일 안 — 빨간색) · waiting = 아직(30일보다 멂) · none = 해당 회차 없음. */
  status: 'recorded' | 'urgent' | 'waiting' | 'none'
}

export type TrialPlanView = {
  next: ProjectedRound | null
  /** 다음 가격 전환(인상) 결제일 — 없으면 null. */
  nextRiseIso: string | null
  rises: RiseView[]
  schedule: ProjectedRound[]
}

export function trialPlanView(
  rounds: readonly ProjectedRound[],
  consents: readonly PriceConsentRow[],
  today: string,
): TrialPlanView {
  const rises: RiseView[] = (['to_half', 'to_full'] as const).map((rise) => {
    const idx = rounds.findIndex((r) => r.rise === rise)
    const r = idx >= 0 ? rounds[idx]! : null
    const c = activeConsentFor(consents, rise)
    const consent = c
      ? { id: c.id, consentedOn: c.consented_on, channel: c.channel, memo: c.memo, recordedBy: c.recorded_by ?? null }
      : null
    const status: RiseView['status'] = c
      ? 'recorded'
      : r
        ? consentStatus({ consent: null, riseChargeIso: r.chargeIso, today })
        : 'none'
    return {
      rise,
      label: PRICE_RISE_LABEL[rise],
      round: r
        ? {
            chargeIso: r.chargeIso,
            shipIso: r.shipIso,
            amount: r.chargeAmount,
            prevAmount: idx > 0 ? rounds[idx - 1]!.chargeAmount : null,
          }
        : null,
      consent,
      status,
    }
  })
  const nextRise = rounds.find((r) => r.rise !== null) ?? null
  return {
    next: rounds[0] ?? null,
    nextRiseIso: nextRise ? nextRise.chargeIso : null,
    rises,
    schedule: [...rounds],
  }
}
