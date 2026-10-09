/**
 * /design-check 예시 값 — 실제 홈(HomeView)에 넣어 로그인 없이 모든 상태를 시안(캔버스 앱①)과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 숫자·이름은 시안과 같은 예시.
 */

import type { HomeViewModel } from '@/components/v3/home/HomeView'
import type { WeekDay } from '@/components/v3/home/ThisWeekSection'
import type { PouchLine } from '@/lib/design/pouch'

const PHOTO = '/sheltie-snow-45.jpg'

/** 기록 시트 예시 이름 — 클라이언트 모듈(SheetsDemo)에 두면 서버 페이지에서 배열이 아니라 참조로 들어온다. */
export const SHEET_KEYS = ['sheet-health', 'sheet-weight', 'sheet-memo', 'sheet-photo', 'sheet-walk', 'sheet-meal'] as const
export type SheetKey = (typeof SHEET_KEYS)[number]

/** 시안과 같은 한 주 — 일 4 ~ 토 10, 오늘 = 수 7. */
function week(recordedThrough: number, todayRecorded = false): WeekDay[] {
  const w = ['일', '월', '화', '수', '목', '금', '토']
  return w.map((weekday, i) => {
    const date = 4 + i
    const isToday = date === 7
    const status: WeekDay['status'] =
      date < 7 ? (date <= recordedThrough ? 'full' : 'miss') : isToday ? (todayRecorded ? 'full' : 'today') : 'future'
    return { date, weekday, status, isToday }
  })
}

const QUICK = [
  { label: '식사', sub: '오늘 기록', kind: 'meal' as const },
  { label: '산책', sub: '오늘 기록', kind: 'walk' as const },
  { label: '체중', sub: '오늘 기록', kind: 'weight' as const },
]

const DDANGKONG = {
  id: '00000000-0000-4000-8000-000000000001',
  name: '땅콩',
  metaLine: '셸티 · 11.2kg · 247일 함께',
  photoUrl: PHOTO,
}

function metrics(delivery: { value: string; sub: string }) {
  return [
    { key: '체중', value: '11.2', sub: 'kg' },
    { key: '연속', value: '5', sub: '일' },
    { key: '오늘 화식', value: '120', sub: 'g' },
    { key: '배송', value: delivery.value, sub: delivery.sub },
  ]
}

const base: HomeViewModel = {
  userName: '보호자',
  dogCount: 1,
  loadFailed: false,
  billingAlert: null,
  boxes: [],
  nextDelivery: null,
  dogTabs: [{ id: DDANGKONG.id, name: DDANGKONG.name, photoUrl: PHOTO }],
  activeDog: { ...DDANGKONG, statusLabel: '정기배송 중', statusTone: 'active', metrics: metrics({ value: '6', sub: '일 후' }) },
  streak: 5,
  weekDays: week(6),
  quickActions: QUICK,
  greetingFixture: { dateLabel: '10월 7일 수요일', timeOfDay: 'evening', variant: 0 },
}

function preparingBox(lines: PouchLine[], itemLabel: string) {
  return {
    key: 'box-1',
    dogLabel: '땅콩이',
    photoUrl: PHOTO,
    stage: 'preparing' as const,
    detail: '주방에서 만들고 있어요 · 2일 뒤 보내드려요',
    itemLabel,
    lines,
    href: '/design-check',
    linkLabel: '자세히',
  }
}

const notSubscribed = (statusLabel: string, statusTone: 'idle' | 'stopped') => ({
  ...base,
  activeDog: { ...DDANGKONG, statusLabel, statusTone, metrics: metrics({ value: '--', sub: '예정' }) },
})

export const HOME_FIXTURES: Record<string, { title: string; mock: string; model: HomeViewModel }> = {
  'home-one': {
    title: '홈 · 한 마리 (박스 준비 중 · 닭고기+흑돼지)',
    mock: 'AppHome',
    model: { ...base, boxes: [preparingBox(['chicken', 'pork'], '닭고기 · 흑돼지 화식')] },
  },
  'home-multi': {
    title: '홈 · 두 마리',
    mock: 'AppHomeMultiTabs',
    model: {
      ...base,
      dogCount: 2,
      dogTabs: [
        { id: DDANGKONG.id, name: '땅콩', photoUrl: PHOTO },
        { id: '00000000-0000-4000-8000-000000000002', name: '보리', photoUrl: null },
      ],
      boxes: [
        preparingBox(['chicken', 'pork'], '닭고기 · 흑돼지 화식'),
        { ...preparingBox(['duck', 'chicken'], '오리고기 · 닭고기 화식'), key: 'box-2', dogLabel: '보리', photoUrl: null },
      ],
    },
  },
  'home-between': {
    title: '홈 · 박스 사이 (8일 연속 기록)',
    mock: 'T01-HomeBetween',
    model: {
      ...base,
      streak: 8,
      weekDays: week(6, true),
      activeDog: { ...DDANGKONG, statusLabel: '정기배송 중', statusTone: 'active', metrics: [
        { key: '체중', value: '11.2', sub: 'kg' },
        { key: '연속', value: '8', sub: '일' },
        { key: '오늘 화식', value: '120', sub: 'g' },
        { key: '배송', value: '6', sub: '일 후' },
      ] },
      nextDelivery: { daysUntil: 6, shipDateLabel: '10월 13일 (화)', checkDetail: null, itemLabel: '닭고기 · 흑돼지 화식', lines: ['chicken', 'pork'] },
    },
  },
  'home-needs-card': {
    title: '홈 · 카드 등록 전',
    mock: 'T02-HomeNeedsCard',
    model: {
      ...notSubscribed('정기배송 전', 'idle'),
      billingAlert: { text: '정기배송을 시작하려면 결제수단을 등록해 주세요.', cta: '결제수단 등록하기', tone: 'danger' },
    },
  },
  'home-card-failed': {
    title: '홈 · 결제가 멈췄을 때',
    mock: 'T03-HomeCardFailed',
    model: {
      ...notSubscribed('배송 멈춤', 'stopped'),
      billingAlert: { text: '결제가 확인되지 않아 정기배송이 멈춰 있어요.', cta: '결제수단 확인하기', tone: 'danger' },
    },
  },
  'home-paused': {
    title: '홈 · 일시정지 중',
    mock: 'T04-HomePaused',
    model: {
      ...notSubscribed('일시정지', 'idle'),
      billingAlert: { text: '정기배송이 일시정지 상태예요.', cta: '정기배송 보기', tone: 'notice' },
    },
  },
  'home-nodog': {
    title: '홈 · 강아지 없음',
    mock: 'T05-HomeNoDog',
    model: { ...base, dogCount: 0, dogTabs: [], activeDog: null },
  },
  'home-failed': {
    title: '홈 · 불러오기 실패',
    mock: 'T06-HomeLoadFailed',
    model: { ...base, dogCount: 0, loadFailed: true, dogTabs: [], activeDog: null },
  },
  'box-chicken': {
    title: '이번 박스 · 닭고기만',
    mock: 'BoxColor-Chicken',
    model: { ...base, boxes: [preparingBox(['chicken'], '닭고기 화식')] },
  },
  'box-duck': {
    title: '이번 박스 · 오리만',
    mock: 'BoxColor-Duck',
    model: { ...base, boxes: [preparingBox(['duck'], '오리고기 화식')] },
  },
  'box-pork': {
    title: '이번 박스 · 흑돼지만',
    mock: 'BoxColor-Pork',
    model: { ...base, boxes: [preparingBox(['pork'], '흑돼지 화식')] },
  },
  'box-beef': {
    title: '이번 박스 · 한우만',
    mock: 'BoxColor-Beef',
    model: { ...base, boxes: [preparingBox(['beef'], '한우 화식')] },
  },
  'box-beef-duck': {
    title: '이번 박스 · 한우+오리 (반반)',
    mock: 'BoxColor-BeefDuck',
    model: { ...base, boxes: [preparingBox(['beef', 'duck'], '한우 · 오리 화식')] },
  },
  'box-shipping': {
    title: '이번 박스 · 배송 중 (송장 있음)',
    mock: '—',
    model: {
      ...base,
      boxes: [{ ...preparingBox(['chicken', 'pork'], '닭고기 · 흑돼지 화식'), stage: 'in_transit', detail: '택배가 오고 있어요', linkLabel: '배송 조회' }],
    },
  },
}
