/**
 * /design-check/analysis 예시 값 — 분석·상담·리포트 화면(캔버스 앱② 2B)을 로그인 없이 시안과 나란히 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 숫자·이름은 시안과 같은 예시(땅콩).
 * 클라이언트 모듈에 두면 서버 페이지가 배열 대신 참조를 받는다 — 일반 .ts 로 둔다.
 */

import type { AnalysisResultModel } from '../../dogs/[id]/analysis/AnalysisView'
import type { Formula, FoodLine } from '@/lib/personalization/types'

export const DOG_ID = '00000000-0000-4000-8000-000000000001'
const PHOTO = '/sheltie-snow-45.jpg'

const SUB: Record<FoodLine, string> = {
  basic: '닭·소를 뺐어요 · 알레르기가 걱정될 때',
  weight: '고단백 · 브로콜리 · 체중 관리에',
  skin: '오메가3 · 피부·털',
  premium: '철분이 풍부해요 · 활동량 많은 아이에게',
  joint: '부드럽고 소화가 편해요',
}
const KO: Record<FoodLine, string> = { basic: '오리', weight: '닭고기', skin: '연어', premium: '한우', joint: '흑돼지' }

function items(lines: FoodLine[], mer: number, feedG: number) {
  const r = 1 / lines.length
  return lines.map((line) => ({
    key: line,
    name: line,
    ko: `${KO[line]} 레시피`,
    pct: Math.round(r * 100),
    kcal: Math.round(mer * r),
    g: Math.round(feedG * r),
    sub: SUB[line],
  }))
}

export function formulaOf(lines: FoodLine[]): Formula {
  const lineRatios = { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0 } as Record<FoodLine, number>
  for (const l of lines) lineRatios[l] = 1 / lines.length
  return {
    lineRatios,
    toppers: { protein: 0, vegetable: 0 },
    reasoning: [
      { trigger: '케어 목표: 체중 관리', action: '체중 관리 위주로 담았어요', chipLabel: '체중 관리 위주', priority: 1, ruleId: 'goal-weight' },
    ],
    transitionStrategy: 'conservative',
    dailyKcal: 600,
    dailyGrams: 511,
    cycleNumber: 1,
    algorithmVersion: 'design-check',
    userAdjusted: false,
  }
}

const base: AnalysisResultModel = {
  dogId: DOG_ID,
  dogName: '땅콩',
  dogBreed: '셰틀랜드 시프도그',
  dogPhotoUrl: PHOTO,
  analysisId: '00000000-0000-4000-8000-0000000000a1',
  createdAt: '2026-09-30T10:00:00+09:00',
  mer: 600,
  rer: 429,
  factor: 1.4,
  feedG: 511,
  stage: '성견 (유지기)',
  bcsScore: 5,
  bcsLabel: 'BCS 4-5',
  riskFlags: [],
  vetConsult: false,
  factorBreakdown: [{ label: '기본 (중성화 성견 · 실내 · 저활동)', delta: 1.4 }],
  aiCached: {
    summary: '지난 2주 동안 체중이 11.2kg 안팎으로 잘 유지되고 있어요. 산책이 길었던 날에도 밥을 남기지 않았어요.',
    nextActions: ['다음 체중은 2주 뒤 같은 시간에 재 주세요', '산책 기록을 하루 한 번만 남겨 주세요'],
  },
  ageLabel: '3세',
  weightKg: 11.2,
  merMin: 552,
  merMax: 648,
  isArchive: false,
  fromSurvey: false,
  totalCount: 2,
  canRefine: false,
  refineBlocked: false,
  subscribedLocked: false,
  hideStart: false,
  boxItems: items(['weight', 'joint'], 600, 511),
  boxLoading: false,
  boxHidden: false,
  boxReasoning: formulaOf(['weight', 'joint']).reasoning,
  pancreatitisGate: false,
}

export type RecFixture = 'ready' | 'consultation' | 'error' | 'no_survey' | 'loading'

export type AnalysisFixture = {
  title: string
  mock: string
  model: AnalysisResultModel
  rec: RecFixture
  /** 화식 양 카드의 구독 이력(문구 '이 박스로 시작하기'). */
  hasSubscription?: boolean
  sheet?: boolean
  toast?: 'survey' | 'refine'
  empty?: boolean
  loading?: boolean
  /** 주소에 fromSurvey=1 을 붙여야 앱 틀이 머리줄·탭을 숨긴다(설문 직후 화면). */
  fromSurveyQuery?: boolean
}

export const ANALYSIS_FIXTURES: Record<string, AnalysisFixture> = {
  analysis: {
    title: '분석 탭 · 기본 (구독 전 — 시작 버튼 보임)',
    mock: 'D08-Analysis',
    model: base,
    rec: 'ready',
  },
  'analysis-subscribed': {
    title: '분석 탭 · 구독 중 (결정 11 — 시작 버튼 숨김)',
    mock: 'D08-Analysis',
    model: { ...base, hideStart: true },
    rec: 'ready',
    hasSubscription: true,
  },
  'analysis-notes': {
    title: '분석 · 참고할 점이 있을 때',
    mock: 'A01-analysis',
    model: { ...base, createdAt: '2026-09-27T10:00:00+09:00', totalCount: 3, riskFlags: ['TREAT_LOAD_DAILY'] },
    rec: 'ready',
  },
  'analysis-after-survey': {
    title: '분석 · 설문 직후 (구독 중 재설문 + 정확도 올리기)',
    mock: 'A02-analysis-after-survey',
    model: {
      ...base,
      createdAt: '2026-10-07T10:00:00+09:00',
      fromSurvey: true,
      subscribedLocked: true,
      hideStart: true,
      canRefine: true,
      totalCount: 4,
    },
    rec: 'ready',
    hasSubscription: true,
    fromSurveyQuery: true,
  },
  'analysis-survey-blocked': {
    title: '분석 · 재분석 한도 안내',
    mock: 'A03-analysis-survey-blocked',
    model: base,
    rec: 'ready',
    toast: 'survey',
  },
  'analysis-refine-blocked': {
    title: '분석 · 추가 답변 한도 안내',
    mock: 'A04-analysis-refine-blocked',
    model: base,
    rec: 'ready',
    toast: 'refine',
  },
  'analysis-empty': {
    title: '분석 · 결과 없음',
    mock: 'D10-AnalysisEmpty',
    model: base,
    rec: 'ready',
    empty: true,
  },
  'analysis-sheet': {
    title: '레시피 고르기 창',
    mock: 'D09-AnalysisRecipeSheet',
    model: { ...base, boxItems: items(['weight', 'basic'], 600, 511) },
    rec: 'ready',
    sheet: true,
  },
  'analysis-consult': {
    title: '분석 · 알레르기로 레시피가 다 빠짐',
    mock: 'I06-AnalysisConsult',
    model: { ...base, boxHidden: true },
    rec: 'consultation',
  },
  'analysis-recfail': {
    title: '분석 · 추천 불러오기 실패',
    mock: 'I07-AnalysisRecFail',
    model: { ...base, boxHidden: true },
    rec: 'error',
  },
  'analysis-nosurvey': {
    title: '분석 · 추천에 설문이 필요할 때',
    mock: '—',
    model: { ...base, boxHidden: true },
    rec: 'no_survey',
  },
  'analysis-archive': {
    title: '지난 분석 보기',
    mock: 'A07-analysis-archive',
    model: { ...base, isArchive: true, createdAt: '2026-06-02T10:00:00+09:00', mer: 613, feedG: 467 },
    rec: 'ready',
  },
  'analysis-loading': {
    title: '분석 · 불러오는 중',
    mock: '—',
    model: base,
    rec: 'loading',
    loading: true,
  },
}
