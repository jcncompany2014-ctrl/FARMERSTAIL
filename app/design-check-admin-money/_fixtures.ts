/**
 * /design-check-admin-money 예시 값 — 실제 부품에 넣어 로그인·DB 없이 그린다. 운영 데이터가 아니다.
 * 일정·금액은 손으로 적지 않고 실제와 같은 정본 함수(projectUserRounds·trialPlanView)로 펼친다.
 * 사람 이름은 '보호자 ○', 강아지 예시 이름은 땅콩(공개 캡처 규칙).
 */
import { projectUserRounds, type FullPrices, type ProjectedRound } from '@/lib/payments/charge-projection'
import { trialPlanView } from '@/lib/admin/trial-plan'
import type { PriceConsentRow } from '@/lib/payments/price-rise'
import { chargeProblemReason } from '@/lib/admin/charge-rows'
import type { TrialRow } from '@/app/admin/trials/TrialsClient'
import type { ChargeListRow, OpenHold } from '@/app/admin/subscriptions/charges/ChargeRowsView'
import type { UpcomingRound } from '@/lib/admin/upcoming-charges'

/** 점검 화면의 '오늘' — 12/1 인상 30일 안이라 빨간 상태가 보인다. */
export const FX_TODAY = '2026-11-05'
const FROM = '2026-11-06'

type Person = {
  id: string
  name: string
  email: string
  dog: string
  subtotal: number
  next: string
  cheap: number
  half: number
  lastPaid: 'cheap' | 'half' | 'full'
  consents: PriceConsentRow[]
}

const consent = (id: string, rise: 'to_half' | 'to_full', on: string, channel: string, memo = ''): PriceConsentRow => ({
  id,
  rise,
  consented_on: on,
  channel,
  memo,
  revoked_at: null,
})

const PEOPLE: Person[] = [
  // 동의 받음(100원→반값) — 초록.
  { id: 'u1', name: '보호자 가', email: 'a@example.com', dog: '땅콩', subtotal: 51500, next: '2026-11-17', cheap: 1, half: 4, lastPaid: 'cheap', consents: [consent('c1', 'to_half', '2026-11-02', 'instagram_dm', '반값 금액 안내 후 좋아요 답장')] },
  // 아직 동의 없음 — 12/1 까지 26일, 빨강.
  { id: 'u2', name: '보호자 나', email: 'b@example.com', dog: '콩이', subtotal: 90000, next: '2026-11-17', cheap: 1, half: 4, lastPaid: 'cheap', consents: [] },
  // 반값 구간 — 정가 전환(1/23)은 아직 멀다(노랑).
  { id: 'u3', name: '보호자 다', email: 'c@example.com', dog: '보리', subtotal: 31500, next: '2026-11-17', cheap: 0, half: 3, lastPaid: 'half', consents: [consent('c3', 'to_half', '2026-10-30', 'kakao')] },
]

function fullOf(subtotal: number): FullPrices {
  return { first: { amount: subtotal, label: null }, recurring: { amount: subtotal, label: null } }
}

function roundsFor(p: Person, stopAtHold: boolean, until: string, maxRounds?: number): ProjectedRound[] {
  return projectUserRounds({
    subs: [{ id: `s-${p.id}`, next_delivery_date: p.next, total_amount: p.subtotal }],
    trial: { cheap_remaining: p.cheap, half_remaining: p.half, cheap_price: 100, half_rate: 0.5 },
    lastPaidPhase: p.lastPaid,
    consents: p.consents,
    fullPriceBySub: new Map([[`s-${p.id}`, fullOf(p.subtotal)]]),
    fromIso: FROM,
    untilChargeIso: until,
    stopAtHold,
    maxRounds,
  })
}

export function trialRowsFixture(): TrialRow[] {
  return PEOPLE.map((p) => ({
    user_id: p.id,
    cheap_remaining: p.cheap,
    half_remaining: p.half,
    cheap_price: 100,
    half_rate: 0.5,
    note: '',
    created_at: '2026-10-01T00:00:00Z',
    profile: { name: p.name, email: p.email },
    subs: [{ id: `s-${p.id}`, status: 'active', dogName: p.dog }],
    plan: trialPlanView(roundsFor(p, false, '2027-12-31', p.cheap + p.half + 2), p.consents, FX_TODAY),
  }))
}

export function upcomingFixture(): UpcomingRound[] {
  const out: UpcomingRound[] = []
  for (const p of PEOPLE) {
    for (const r of roundsFor(p, true, '2026-12-31')) {
      out.push({ ...r, userId: p.id, customerName: p.name, dogName: p.dog })
    }
  }
  // 정상가 고객(사장님 시험 계정 모양) — 11/10 발송분을 11/7(토)에 32,700원.
  for (const r of projectUserRounds({
    subs: [{ id: 's-test', next_delivery_date: '2026-11-10', total_amount: 32700 }],
    trial: null,
    lastPaidPhase: 'full',
    consents: [],
    fullPriceBySub: new Map([['s-test', fullOf(32700)]]),
    fromIso: FROM,
    untilChargeIso: '2026-12-31',
    stopAtHold: true,
  })) {
    out.push({ ...r, userId: 'u-test', customerName: '보호자 라', dogName: '두부' })
  }
  return out.sort((a, b) => (a.chargeIso < b.chargeIso ? -1 : a.chargeIso > b.chargeIso ? 1 : 0))
}

const base = {
  subscription_id: 's1',
  payment_key: null,
  order_id: null,
  completed_at: null,
}

export const CHARGE_ROWS: ChargeListRow[] = [
  {
    ...base,
    id: 'ch1',
    user_id: 'u2',
    scheduled_for: '2026-11-07',
    status: 'failed',
    amount: 32700,
    error_code: 'REJECT_CARD_PAYMENT',
    error_message: 'Card payment rejected',
    attempted_at: '2026-11-07T00:10:12Z',
    detail: { customerName: '보호자 라', dogName: '두부', cardLast4: '4821', nextRetryAt: '2026-11-08T00:05:00Z', subStatus: 'active', reason: chargeProblemReason({ status: 'failed', error_code: 'REJECT_CARD_PAYMENT', error_message: null }) },
  },
  {
    ...base,
    id: 'ch2',
    user_id: 'u1',
    scheduled_for: '2026-11-03',
    status: 'pending',
    amount: 100,
    error_code: null,
    error_message: null,
    attempted_at: '2026-11-03T00:10:40Z',
    detail: { customerName: '보호자 가', dogName: '땅콩', cardLast4: '1093', nextRetryAt: null, subStatus: 'active', reason: chargeProblemReason({ status: 'pending', error_code: null, error_message: null }) },
  },
  {
    ...base,
    id: 'ch3',
    user_id: 'u3',
    scheduled_for: '2026-11-01',
    status: 'failed',
    amount: 31500,
    error_code: 'NO_SHIPPING_ADDRESS',
    error_message: '배송지가 등록되지 않아 결제를 진행할 수 없어요.',
    attempted_at: '2026-11-01T00:10:05Z',
    detail: { customerName: '보호자 다', dogName: '보리', cardLast4: null, nextRetryAt: null, subStatus: 'active', reason: chargeProblemReason({ status: 'failed', error_code: 'NO_SHIPPING_ADDRESS', error_message: null }) },
  },
  {
    ...base,
    id: 'ch5',
    user_id: 'u9',
    scheduled_for: '2026-10-31',
    status: 'skipped',
    amount: 51500,
    error_code: null,
    error_message: null,
    attempted_at: '2026-10-31T00:10:09Z',
    // 고객 정보 조회가 실패한 모양 — 행은 그대로 보이고 '불러오지 못했어요'.
    detail: null,
  },
  {
    ...base,
    id: 'ch4',
    user_id: 'u1',
    scheduled_for: '2026-10-20',
    status: 'succeeded',
    amount: 100,
    error_code: null,
    error_message: null,
    order_id: 'o1',
    attempted_at: '2026-10-20T00:10:02Z',
    completed_at: '2026-10-20T00:10:04Z',
    detail: null,
  },
]

export const OPEN_HOLDS: OpenHold[] = [
  {
    id: 'h1',
    subscriptionId: 's-u2',
    userId: 'u2',
    shipDate: '2026-12-01',
    chargeDate: '2026-12-01',
    rise: 'to_half',
    chargeAmount: 45000,
    listAmount: 90000,
    firstHeldAt: '2026-12-01T00:10:20Z',
    customerName: '보호자 나',
    dogName: '콩이',
  },
]
