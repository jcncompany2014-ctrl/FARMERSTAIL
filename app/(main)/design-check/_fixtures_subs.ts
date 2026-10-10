/**
 * /design-check 예시 값 — 정기배송 탭(SubscriptionsSummaryView) 상태들. 캔버스 AppSubList·S11~S15·C03 과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 숫자·이름은 시안과 같은 예시.
 */

import type { SubsSummaryModel } from '@/components/v3/subs/SubscriptionsSummaryView'
import type { PriceChangeProposal } from '@/app/account/subscriptions/PriceChangeConsentModal'

/** 금액 변경 동의 창(캔버스 S16·S17) — 정기배송 탭 위에 뜬다. forced = 알레르기·건강 때문이라 '유지' 전에 경고. */
export const PRICE_PROPOSALS: Record<string, { title: string; mock: string; proposal: PriceChangeProposal }> = {
  'price-consent': {
    title: '금액 변경 동의 창',
    mock: 'S16-price-consent',
    proposal: {
      dogId: 'd1',
      dogName: '땅콩',
      cycleNumber: 2,
      recipeLabel: '닭고기·흑돼지 레시피',
      reason: '그동안의 체크인과 몸무게 변화를 반영했어요.',
      forced: false,
      priceFrom: 77800,
      priceTo: 80400,
    },
  },
  'price-consent-forced': {
    title: "금액 변경 동의 창 · 알레르기 반영 — '이전 그대로 유지' 누르기",
    mock: 'S17-price-consent-keep-warn',
    proposal: {
      dogId: 'd1',
      dogName: '땅콩',
      cycleNumber: 2,
      recipeLabel: '닭고기·흑돼지 레시피',
      reason: '새로 알려 주신 알레르기를 반영했어요.',
      forced: true,
      priceFrom: 77800,
      priceTo: 80400,
    },
  },
}

const PHOTO = '/sheltie-snow-45.jpg'

const DDANGKONG_ROW = {
  id: 'sub-1',
  dogName: '땅콩',
  photoUrl: PHOTO,
  state: 'active' as const,
  stateLabel: '구독 중',
  line: '77,800원 · 곁들임 · 10월 10일 (토) 결제',
  href: '/design-check',
  focused: false,
  lines: ['chicken', 'pork'] as SubsSummaryModel['rows'][number]['lines'],
}

const base: SubsSummaryModel = {
  justStarted: false,
  alerts: [],
  hero: null,
  empty: null,
  trialCard: null,
  startable: [],
  rows: [],
}

const hero77 = {
  dateText: '10월 10일 (토)',
  amount: 77800,
  subtotal: 77800,
  discount: 0,
  discountText: null,
  breakdown: [],
  methodLine: '신한카드 ····1234',
  trial: null,
}

export const SUBS_FIXTURES: Record<string, { title: string; mock: string; model: SubsSummaryModel | 'error' }> = {
  'subs-two': {
    title: '정기배송 탭 · 두 마리 같은 날 결제',
    mock: 'AppSubList',
    model: {
      ...base,
      hero: {
        ...hero77,
        amount: 114200,
        subtotal: 114200,
        breakdown: [
          { name: '땅콩', amount: 77800 },
          { name: '보리', amount: 36400 },
        ],
      },
      rows: [
        DDANGKONG_ROW,
        { ...DDANGKONG_ROW, id: 'sub-2', dogName: '보리', photoUrl: null, line: '36,400원 · 곁들임 · 10월 10일 (토) 결제', lines: ['duck', 'chicken'] },
      ],
    },
  },
  'subs-empty': {
    title: '정기배송 탭 · 하나도 없을 때',
    mock: 'S11-sublist-empty',
    model: {
      ...base,
      empty: { title: '진행 중인 정기배송이 없어요', sub: '아래 버튼으로 바로 시작할 수 있어요.' },
      startable: [
        { id: 'd1', label: '땅콩이 정기배송 시작하기', ready: true, href: '/design-check', photoUrl: PHOTO },
        { id: 'd2', label: '보리 설문하고 시작하기', ready: false, href: '/design-check', photoUrl: null },
      ],
    },
  },
  'subs-card-failed': {
    title: '정기배송 탭 · 결제 실패 경고',
    mock: 'S12-sublist-card-failed',
    model: {
      ...base,
      alerts: [{ key: 'a1', kind: 'card_failed', dogLabel: '보리', href: '/design-check' }],
      hero: hero77,
      rows: [
        { ...DDANGKONG_ROW, id: 'sub-2', dogName: '보리', photoUrl: null, state: 'card_failed', stateLabel: '결제 확인 필요', line: '36,400원 · 곁들임', lines: ['duck', 'chicken'] },
        DDANGKONG_ROW,
      ],
    },
  },
  'subs-needs-card': {
    title: '정기배송 탭 · 시작 전 경고',
    mock: 'S13-sublist-needs-card',
    model: {
      ...base,
      alerts: [{ key: 'a1', kind: 'needs_card', dogLabel: '땅콩이', href: '/design-check' }],
      empty: { title: '아직 결제 예정이 없어요', sub: '결제수단을 등록하면 첫 결제일이 정해져요.' },
      startable: [{ id: 'd2', label: '보리 설문하고 시작하기', ready: false, href: '/design-check', photoUrl: null }],
      rows: [{ ...DDANGKONG_ROW, state: 'needs_card', stateLabel: '시작 전', line: '77,800원 · 곁들임' }],
    },
  },
  'subs-error': {
    title: '정기배송 탭 · 불러오기 실패',
    mock: 'S14-sublist-load-error',
    model: 'error',
  },
  'subs-started': {
    title: '정기배송 탭 · 막 시작했을 때',
    mock: 'S15-sublist-started',
    model: {
      ...base,
      justStarted: true,
      hero: hero77,
      startable: [{ id: 'd2', label: '보리 설문하고 시작하기', ready: false, href: '/design-check', photoUrl: null }],
      rows: [DDANGKONG_ROW],
    },
  },
  'subs-supporter': {
    title: '정기배송 탭 · 서포터즈 혜택',
    mock: 'C03-SubTabSupporter',
    model: {
      ...base,
      hero: {
        ...hero77,
        dateText: '10월 13일 (화)',
        amount: 100,
        subtotal: 77800,
        discount: 77700,
        discountText: '서포터즈 혜택으로 77,700원 할인',
        trial: { cheap: 4, half: 4, price: 100, intervalDays: 14 },
      },
      rows: [{ ...DDANGKONG_ROW, line: '77,800원 · 곁들임 · 10월 13일 (화) 결제' }],
    },
  },
}
