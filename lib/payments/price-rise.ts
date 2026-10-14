/**
 * 서포터즈 가격 인상 회차 판정 — **청구 크론·어드민 화면·포장 목록이 같은 함수를 쓴다** (2026-10-14 A1).
 *
 * # 왜
 * 서포터즈는 100원 → 반값 → 정가로 값이 오른다. 정기결제 대금을 올리려면 고객의 동의가 있어야 하는데
 * (전자상거래법 2025-02 개정 — 증액 사전 동의), 그 동의를 받았는지 기록이 없었다. 이제 사장님이 동의를 받으면
 * 어드민에 기록하고(subscription_price_consents), 청구 크론은 **가격이 오르는 회차인데 그 인상의 동의 기록이 없으면
 * 청구하지 않고 보류**한다(subscription_charge_holds). 같은 판정을 화면(체험단 일정표·다가오는 결제·포장 목록)이
 * 따로 짜면 두 화면이 다른 말을 한다 — 판정은 여기 한 곳, 순수 함수.
 *
 * # '가격이 오르는 회차'의 정의
 * 이번 회차의 가격 구간이 **바로 앞에 결제된 회차**의 구간보다 높다. 구간 순서 = 100원(cheap) < 반값(half) < 정가(full).
 *  · 100원 → 반값 첫 회 = to_half, 반값 → 정가 첫 회 = to_full(반값 없이 100원 → 정가로 가도 to_full).
 *  · 앞에 결제된 회차가 없으면(첫 결제) 인상이 아니다 — 도장 전 정가를 내던 고객이 반값부터 시작해도 인상이 아니다.
 *  · 회차 정보는 구독마다가 아니라 **사람마다**다(subscription_trials 가 user 단위) — '앞 회차'도 그 사람의 앞 결제.
 *  · 체험 도장(subscription_trials 행)이 없는 사람은 판정하지 않는다 — 정상가 고객은 영향 0.
 *
 * 순수 함수 — DB·시간 없이 재현·테스트 가능해야 돈 판단을 믿을 수 있다(lib/payments/trial.ts 와 같은 원칙).
 */

export type PricePhase = 'cheap' | 'half' | 'full'
export type PriceRise = 'to_half' | 'to_full'

/** 판정에 필요한 체험 상태 — subscription_trials 의 부분집합. */
export type TrialPhaseState = { cheap_remaining: number; half_remaining: number }

/** 동의 기록 한 줄 — subscription_price_consents 의 부분집합. */
export type PriceConsentRow = {
  id: string
  rise: PriceRise | string
  consented_on: string
  channel: string
  memo: string
  revoked_at: string | null
  /** 기록한 관리자(auth.users.id) — 화면 표시용. 판정엔 쓰지 않는다. */
  recorded_by?: string | null
}

const RANK: Record<PricePhase, number> = { cheap: 0, half: 1, full: 2 }

/** 화면 이름 — 어드민 전용. */
export const PRICE_RISE_LABEL: Record<PriceRise, string> = {
  to_half: '100원 → 반값',
  to_full: '반값 → 정가',
}

export const PRICE_PHASE_LABEL: Record<PricePhase, string> = {
  cheap: '100원',
  half: '반값',
  full: '정가',
}

/** 동의를 받은 경로 — DB check 와 같은 목록(20261014200000). */
export const CONSENT_CHANNELS = ['instagram_dm', 'kakao', 'sms', 'phone', 'email', 'in_person', 'other'] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]
export const CONSENT_CHANNEL_LABEL: Record<ConsentChannel, string> = {
  instagram_dm: '인스타 DM',
  kakao: '카카오톡',
  sms: '문자',
  phone: '전화',
  email: '메일',
  in_person: '직접 만나서',
  other: '기타',
}

/** 인상 회차 며칠 전부터 '아직 동의 없음'을 빨간색으로 — 증액 사전 고지·동의 기간(30일). */
export const CONSENT_RED_DAYS = 30

/** 지금 체험 상태의 가격 구간. 체험 도장이 없으면 null(정상가 고객 — 판정 대상 아님). */
export function phaseOf(trial: TrialPhaseState | null | undefined): PricePhase | null {
  if (!trial) return null
  if (trial.cheap_remaining > 0) return 'cheap'
  if (trial.half_remaining > 0) return 'half'
  return 'full'
}

/**
 * 결제된 주문의 할인 사유 → 그 회차의 가격 구간. 청구 크론이 orders.discount_reason 에
 * resolveAutoDiscount 의 reason 을 그대로 적는다(trial_cheap·trial_half·그 밖 = 정가 구간).
 */
export function phaseFromDiscountReason(reason: string | null | undefined): PricePhase {
  if (reason === 'trial_cheap') return 'cheap'
  if (reason === 'trial_half') return 'half'
  return 'full'
}

/** 앞 회차 → 이번 회차가 가격 인상인가. 앞 회차가 없으면 인상이 아니다. */
export function priceRiseBetween(prev: PricePhase | null | undefined, next: PricePhase): PriceRise | null {
  if (!prev) return null
  if (RANK[next] <= RANK[prev]) return null
  return next === 'half' ? 'to_half' : 'to_full'
}

/** 유효한(취소 안 된) 동의 기록 — 한 사람·한 인상에 하나(DB 부분 유일 색인). */
export function activeConsentFor(
  consents: readonly PriceConsentRow[] | null | undefined,
  rise: PriceRise,
): PriceConsentRow | null {
  for (const c of consents ?? []) {
    if (c.rise === rise && !c.revoked_at) return c
  }
  return null
}

export type PriceRiseGate =
  | { hold: false; rise: PriceRise | null; phase: PricePhase | null }
  | { hold: true; rise: PriceRise; phase: PricePhase }

/**
 * 이번 회차를 청구해도 되는가 — 청구 크론의 판정 정본.
 *  · 체험 도장이 없으면(정상가 고객) 언제나 통과.
 *  · 이번 회차가 인상 회차인데 그 인상의 유효한 동의 기록이 없으면 hold.
 *  · 100원 구간 회차는 인상이 될 수 없다(가장 낮은 구간) — 언제나 통과.
 */
export function priceRiseGate(input: {
  trial: TrialPhaseState | null | undefined
  lastPaidPhase: PricePhase | null | undefined
  consents: readonly PriceConsentRow[] | null | undefined
}): PriceRiseGate {
  const phase = phaseOf(input.trial)
  if (!phase) return { hold: false, rise: null, phase: null }
  const rise = priceRiseBetween(input.lastPaidPhase ?? null, phase)
  if (!rise) return { hold: false, rise: null, phase }
  if (activeConsentFor(input.consents, rise)) return { hold: false, rise, phase }
  return { hold: true, rise, phase }
}

/**
 * 인상 회차의 동의 상태 — 어드민 화면용.
 *  · recorded: 유효한 동의 기록이 있다.
 *  · urgent: 기록이 없고 인상 결제일이 30일 안(또는 지남) — 빨간색.
 *  · waiting: 기록이 없지만 아직 30일보다 멀다.
 */
export function consentStatus(input: {
  consent: PriceConsentRow | null
  /** 인상 회차의 결제일(KST yyyy-mm-dd). */
  riseChargeIso: string
  /** 오늘(KST yyyy-mm-dd). */
  today: string
}): 'recorded' | 'urgent' | 'waiting' {
  if (input.consent) return 'recorded'
  return daysBetween(input.today, input.riseChargeIso) <= CONSENT_RED_DAYS ? 'urgent' : 'waiting'
}

/** a → b 일수(b − a). 문자열 날짜 그대로 — 서버(UTC)·기기 시간대를 타지 않는다. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${bIso.slice(0, 10)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * 동의 기록 입력 검사 — 서버 라우트 전용(화면도 같은 함수로 미리 막는다).
 * 동의한 날은 오늘(KST)보다 미래일 수 없고, 서포터즈 시작(2026-09-01) 이전일 수 없다.
 */
export function validateConsentInput(
  input: { rise?: unknown; consentedOn?: unknown; channel?: unknown; memo?: unknown },
  today: string,
): { ok: true; rise: PriceRise; consentedOn: string; channel: ConsentChannel; memo: string } | { ok: false; message: string } {
  const rise = input.rise
  if (rise !== 'to_half' && rise !== 'to_full') return { ok: false, message: '어느 인상인지 골라 주세요' }
  const on = typeof input.consentedOn === 'string' ? input.consentedOn.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(`${on}T00:00:00Z`))) {
    return { ok: false, message: '동의한 날짜를 입력해 주세요' }
  }
  if (on > today) return { ok: false, message: '동의한 날짜가 오늘보다 뒤예요' }
  if (on < '2026-09-01') return { ok: false, message: '동의한 날짜가 너무 이전이에요' }
  const channel = input.channel
  if (typeof channel !== 'string' || !(CONSENT_CHANNELS as readonly string[]).includes(channel)) {
    return { ok: false, message: '동의를 받은 경로를 골라 주세요' }
  }
  const memo = typeof input.memo === 'string' ? input.memo.trim() : ''
  if (memo.length > 500) return { ok: false, message: '메모는 500자까지예요' }
  return { ok: true, rise, consentedOn: on, channel: channel as ConsentChannel, memo }
}
