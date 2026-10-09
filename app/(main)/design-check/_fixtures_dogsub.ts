/**
 * /design-check 예시 값 — 강아지 정기배송 화면(DogSubscriptionClient) 상태들. 캔버스 AppSub·S01~S10 과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 버튼을 눌러도 로그인이 없어 저장되지 않는다.
 *
 * 날짜는 **오늘 기준으로 실제 일정 함수**(lib/shipping-schedule)가 정한다 — 화면의 판정(결제일·되돌리기 마감·
 * 이번 박스 단계)이 실제와 같은 길로 그려지게. 시안(10월 9일 기준)과 같은 날 찍으면 날짜까지 같다.
 * 아래에서 올라오는 창(S06·S08·S09·S10)은 같은 상태에서 그 버튼을 눌러 띄운다(점검 촬영 도구가 누른다).
 */

import type { DogSub, ChargePreview } from '../dogs/[id]/subscription/DogSubscriptionClient'
import type { TrialState } from '@/lib/payments/trial'
import { chargeDateFor, nextCycleDate, nextShipDate, type ChargeTiming } from '@/lib/shipping-schedule'
import { todayKstIsoDate } from '@/lib/datetime-kst'

export type DogSubFixtureProps = {
  initialSubs: DogSub[]
  dogName: string
  dogPhoto: string | null
  startHref: string
  trial: TrialState | null
  chargeTiming: ChargeTiming | null
  inProgress: Record<string, boolean>
  inProgressPaidAt: Record<string, string>
  inTransit: Record<string, boolean>
  paidStateUnknown: boolean
  chargePreview: Record<string, ChargePreview> | null
}

export type DogSubFixture = {
  title: string
  mock: string
  /** 찍기 전에 누를 버튼 글자(시트 시안) — 점검 목록에 적어 두는 메모. */
  press?: string
  props: () => DogSubFixtureProps
}

const PHOTO = '/sheltie-snow-45.jpg'

function sub(over: Partial<DogSub> = {}): DogSub {
  const ship = nextShipDate(todayKstIsoDate(), 'before_cooking')
  return {
    id: 'sub-1',
    status: 'active',
    interval_weeks: 2,
    total_deliveries: 3,
    total_amount: 77800,
    fresh_ratio: 30,
    recipient_name: '보호자',
    address: null,
    address_detail: null,
    has_billing_key: true,
    billing_card_brand: '신한카드',
    billing_card_last4: '1234',
    billing_customer_key: 'ck-design-check',
    last_failed_charge_reason: null,
    created_at: '2026-08-20T10:00:00+09:00',
    subscription_items: [
      { product_name: '닭고기 화식 (120g 한 끼)', quantity: 7 },
      { product_name: '흑돼지 화식 (120g 한 끼)', quantity: 7 },
    ],
    next_delivery_date: ship,
    failed_charge_count: 0,
    requires_billing_key_renewal: false,
    ...over,
  }
}

function props(over: Partial<DogSubFixtureProps> = {}): DogSubFixtureProps {
  return {
    initialSubs: [sub()],
    dogName: '땅콩',
    dogPhoto: PHOTO,
    startHref: '/design-check',
    trial: null,
    chargeTiming: 'before_cooking',
    inProgress: {},
    inProgressPaidAt: {},
    inTransit: {},
    paidStateUnknown: false,
    chargePreview: { 'sub-1': { chargeAmount: 77800, label: null, reason: 'none' } },
    ...over,
  }
}

/** 이번 발송(화)·그다음 발송 — 오늘 기준. */
function ships() {
  const first = nextShipDate(todayKstIsoDate(), 'before_cooking')
  return { first, second: nextCycleDate(first) }
}

export const DOGSUB_FIXTURES: Record<string, DogSubFixture> = {
  'dogsub-active': {
    title: '정기배송 상세 · 구독 중',
    mock: 'AppSub',
    props: () => props(),
  },
  'dogsub-paused': {
    title: '정기배송 상세 · 일시정지',
    mock: 'S01-sub-paused',
    props: () => props({ initialSubs: [sub({ status: 'paused' })] }),
  },
  'dogsub-cancelled': {
    title: '정기배송 상세 · 해지(쉬는 중)',
    mock: 'S02-sub-cancelled',
    props: () => props({ initialSubs: [sub({ status: 'cancelled', next_delivery_date: null })], chargePreview: null }),
  },
  'dogsub-needs-card': {
    title: '정기배송 상세 · 시작 전',
    mock: 'S03-sub-needs-card',
    props: () =>
      props({
        initialSubs: [
          sub({
            has_billing_key: false,
            billing_card_brand: null,
            billing_card_last4: null,
            total_deliveries: 0,
            next_delivery_date: null,
          }),
        ],
        chargePreview: null,
      }),
  },
  'dogsub-card-failed': {
    title: '정기배송 상세 · 결제 실패',
    mock: 'S04-sub-card-failed',
    props: () => props({ initialSubs: [sub({ failed_charge_count: 1, requires_billing_key_renewal: true })] }),
  },
  'dogsub-in-progress': {
    title: '정기배송 상세 · 이번 박스 진행 중',
    mock: 'S05-sub-box-in-progress',
    props: () => {
      // 이번 발송분이 토요일 아침에 결제됐고(조리 중), 다음 발송일은 그다음 회차로 넘어간 상태.
      const { first, second } = ships()
      return props({
        initialSubs: [sub({ next_delivery_date: second, total_deliveries: 4 })],
        inProgress: { 'sub-1': true },
        inProgressPaidAt: { 'sub-1': `${chargeDateFor(first, 'before_cooking')}T09:10:00+09:00` },
      })
    },
  },
  'dogsub-skipped': {
    title: '정기배송 상세 · 미룬 뒤(되돌리기)',
    mock: 'S07-sub-skipped-undo',
    props: () => props({ initialSubs: [sub({ next_delivery_date: ships().second })] }),
  },
  'dogsub-sheet-skip': {
    title: '정기배송 상세 · 미루기 확인 창',
    mock: 'S06-sub-skip-sheet',
    press: '2주 미루기',
    props: () => props(),
  },
  'dogsub-sheet-ratio': {
    title: '정기배송 상세 · 화식 비율 창',
    mock: 'S08-sub-ratio-sheet',
    press: '화식 비율',
    props: () => props(),
  },
  'dogsub-sheet-cancel': {
    title: '정기배송 상세 · 해지 확인 창',
    mock: 'S09-sub-cancel-sheet',
    press: '정기배송 해지',
    props: () => props(),
  },
  'dogsub-sheet-withdraw': {
    title: '정기배송 상세 · 신청 취소 확인 창',
    mock: 'S10-sub-withdraw-sheet',
    press: '정기배송 신청 취소',
    props: () => DOGSUB_FIXTURES['dogsub-needs-card']!.props(),
  },
  'dogsub-sheet-pause': {
    title: '정기배송 상세 · 일시정지 확인 창(새로 넣음)',
    mock: '시안 없음 — S06 틀',
    press: '일시정지',
    props: () => props(),
  },
  'dogsub-sheet-resume': {
    title: '정기배송 상세 · 다시 시작 확인 창(새로 넣음)',
    mock: '시안 없음 — S06 틀',
    press: '다시 시작',
    props: () => DOGSUB_FIXTURES['dogsub-paused']!.props(),
  },
}
