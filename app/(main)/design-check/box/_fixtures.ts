/**
 * /design-check/box 예시 값 — 맞춤 박스 기록·새 식단 확인·체크인 화면(묶음 ③-C)을 로그인 없이 시안과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 이름·숫자는 시안과 같은 예시(땅콩).
 *
 * 클라이언트 모듈에 두면 서버 페이지가 배열 대신 참조를 받는다 — 그래서 일반 .ts 다.
 * 하루 양(g)은 실제 화면처럼 kcal + 레시피 비율로 다시 센다(dailyGramsOf — 규칙35).
 */

import { dailyGramsOf } from '@/lib/personalization/dailyGrams'
import type { FoodLine, Formula, Reasoning } from '@/lib/personalization/types'
import type { FormulaViewRow } from '../../dogs/[id]/formulas/FormulasView'
import type { ApprovePricing } from '../../dogs/[id]/approve/page'
import type { CheckinPreview } from '../../dogs/[id]/checkin/CheckinClient'

export const DOG_ID = '00000000-0000-4000-8000-000000000001'
export const DOG_NAME = '땅콩'

/** 화면 이름 → [제목, 시안 보드, 경로]. 목록 순서 = 점검 화면 목록 순서. */
export const SCREENS: Array<[key: string, title: string, mock: string, path: string]> = [
  ['formulas', '맞춤 박스 기록 · 한 개', 'S20-formulas', '/design-check/box'],
  ['formulas-pending', '맞춤 박스 기록 · 동의 필요', 'S21-formulas-pending', '/design-check/box'],
  ['formulas-empty', '맞춤 박스 기록 · 비었을 때', 'I03-FormulasEmpty', '/design-check/box'],
  ['formulas-many', '맞춤 박스 기록 · 여러 개(한우 바탕·유지됨·직접 조정)', '—', '/design-check/box'],
  ['approve', '새 식단 확인 · 금액 그대로', 'S22-approve', '/design-check/box/approve'],
  ['approve-up', '새 식단 확인 · 금액 오름', '—', '/design-check/box/approve'],
  ['approve-down', '새 식단 확인 · 금액 내림', '—', '/design-check/box/approve'],
  ['approve-missing', '새 식단 확인 · 대기 건 없음', '—', '/design-check/box/approve'],
  ['week2', '체크인 · 2주차', 'S23-checkin-week2', '/design-check/box/checkin'],
  ['week4', '체크인 · 4주차', 'S24-checkin-week4', '/design-check/box/checkin'],
  ['answered', '체크인 · 이미 답함', 'S25-checkin-answered', '/design-check/box/checkin'],
  ['result', '체크인 · 맞춤 피드백', 'S26-checkin-result', '/design-check/box/checkin'],
  ['first', '첫 박스 체크인', 'S27-first-checkin', '/design-check/box/checkin'],
  ['first-done', '첫 박스 체크인 · 보낸 뒤', 'S28-first-checkin-done', '/design-check/box/checkin'],
]

// ── 레시피 비율 — 엔진 라인 키(weight=닭 · joint=흑돼지 · premium=한우 · basic=오리 · skin=연어) ──
const ratios = (r: Partial<Record<FoodLine, number>>): Record<FoodLine, number> => ({
  basic: 0,
  weight: 0,
  skin: 0,
  premium: 0,
  joint: 0,
  ...r,
})
/** 닭 60 · 흑돼지 40 → 박스는 50:50(스냅). */
const CHICKEN_PORK = ratios({ weight: 0.6, joint: 0.4 })
/** 닭 한 가지. */
const CHICKEN = ratios({ weight: 1 })
/** 한우 50 · 오리 50(한우 바탕 = 흰 글자 확인용). */
const BEEF_DUCK = ratios({ premium: 0.5, basic: 0.5 })

const grams = (kcal: number, lineRatios: Record<string, number>) =>
  dailyGramsOf({ daily_kcal: kcal, formula: { lineRatios } }) ?? 0

const NO_TOPPER = { vegetable: 0, protein: 0 }

const ROW_CYCLE1: FormulaViewRow = {
  id: 'f1',
  cycle_number: 1,
  approval_status: 'auto_applied',
  formula: { lineRatios: CHICKEN_PORK, toppers: NO_TOPPER },
  reasoning: [{ chipLabel: '맞춤 베이스', ruleId: 'base' }],
  daily_kcal: 600,
  grams: grams(600, CHICKEN_PORK),
  applied_from: '2026-09-30',
  applied_until: null,
  user_adjusted: false,
  algorithm_version: 'v3.2',
  created_at: '2026-09-30T01:00:00Z',
}

const ROW_CYCLE2_PENDING: FormulaViewRow = {
  id: 'f2',
  cycle_number: 2,
  approval_status: 'pending_approval',
  formula: { lineRatios: CHICKEN, toppers: NO_TOPPER },
  reasoning: [{ chipLabel: '지속 무름 → 단일 단백질', ruleId: 'persistent-loose' }],
  daily_kcal: 600,
  grams: grams(600, CHICKEN),
  applied_from: null,
  applied_until: null,
  user_adjusted: false,
  algorithm_version: 'v3.2',
  // KST 10.7 정오
  created_at: '2026-10-07T03:00:00Z',
}

export const FORMULA_ROWS: Record<string, FormulaViewRow[]> = {
  formulas: [ROW_CYCLE1],
  'formulas-pending': [ROW_CYCLE2_PENDING, ROW_CYCLE1],
  'formulas-empty': [],
  'formulas-many': [
    {
      id: 'f4',
      cycle_number: 4,
      approval_status: 'approved',
      formula: { lineRatios: BEEF_DUCK, toppers: { vegetable: 0.1, protein: 0 } },
      reasoning: [
        { chipLabel: '시니어 · 관절 보강', ruleId: 'senior-joint' },
        { chipLabel: '실내 활발 OK', ruleId: 'indoor-active' },
        { chipLabel: '선호 단백질 가산', ruleId: 'pref' },
      ],
      daily_kcal: 640,
      grams: grams(640, BEEF_DUCK),
      applied_from: '2026-11-11',
      applied_until: null,
      user_adjusted: true,
      algorithm_version: 'v3.2',
      created_at: '2026-11-08T01:00:00Z',
    },
    {
      id: 'f3',
      cycle_number: 3,
      approval_status: 'declined',
      formula: { lineRatios: CHICKEN, toppers: NO_TOPPER },
      reasoning: [{ chipLabel: '4주차 무름 → 지방 ↓', ruleId: 'w4-loose' }],
      daily_kcal: 600,
      grams: grams(600, CHICKEN),
      applied_from: null,
      applied_until: null,
      user_adjusted: false,
      algorithm_version: 'v3.2',
      created_at: '2026-10-28T01:00:00Z',
    },
    { ...ROW_CYCLE1, applied_until: '2026-10-27' },
  ],
}

// ── 새 식단 확인(approve) ──
const formula = (lineRatios: Record<FoodLine, number>, cycle: number, reasoning: Reasoning[]): Formula => ({
  lineRatios,
  toppers: NO_TOPPER,
  reasoning,
  transitionStrategy: 'gradual',
  dailyKcal: 600,
  dailyGrams: grams(600, lineRatios),
  cycleNumber: cycle,
  algorithmVersion: 'v3.2',
  userAdjusted: false,
})

export const APPROVE_PREVIOUS = formula(CHICKEN_PORK, 1, [
  { trigger: '첫 박스', action: '맞춤 베이스로 시작해요', chipLabel: '맞춤 베이스', priority: 5, ruleId: 'base' },
])

export const APPROVE_PENDING = formula(CHICKEN, 2, [
  {
    trigger: '2주+4주 변 무름 지속',
    // 시안 문구(실제 엔진은 FOOD_LINE_META.nameKo '치킨'을 넣는다 — 보고서에 적음).
    action: '닭고기 레시피 한 가지로 잠시 돌아가요 (위장을 쉬게 해요)',
    chipLabel: '지속 무름 → 단일 단백질',
    priority: 1,
    ruleId: 'persistent-loose',
  },
])

export const APPROVE_PRICING: Record<string, ApprovePricing | null> = {
  approve: { currentTotal: 77800, newTotal: 77800, freshRatio: 50 },
  'approve-up': { currentTotal: 77800, newTotal: 85400, freshRatio: 50 },
  'approve-down': { currentTotal: 77800, newTotal: 71200, freshRatio: 50 },
  'approve-missing': null,
}

// ── 체크인 ──
export const CHECKIN_PREVIEW: Record<string, { checkpoint: 'week_2' | 'week_4'; preview: CheckinPreview }> = {
  week2: {
    checkpoint: 'week_2',
    preview: { dogName: DOG_NAME, answers: { stool: 4, coat: 4, appetite: null } },
  },
  week4: {
    checkpoint: 'week_4',
    preview: { dogName: DOG_NAME, answers: { stool: 4, coat: 4, appetite: 5, satisfaction: null } },
  },
  answered: {
    checkpoint: 'week_2',
    preview: {
      dogName: DOG_NAME,
      existing: {
        stoolScore: 4,
        coatScore: 4,
        appetiteScore: 5,
        overallSatisfaction: null,
        freeText: '밥 먹는 속도가 빨라졌어요',
      },
      answers: { stool: 4, coat: 4, appetite: 5, freeText: '밥 먹는 속도가 빨라졌어요' },
    },
  },
  result: {
    checkpoint: 'week_2',
    preview: {
      dogName: DOG_NAME,
      result: { notes: ['특이 신호가 없어요 — 지금 식단을 그대로 이어 갈게요.'], shouldReanalyze: false },
    },
  },
}
