/**
 * /design-check/analysis 예시 값 (2) — 분석 기록·진료 보고서·연말 결산·건강 리포트·AI 상담·분석 맞춤도.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 숫자·이름은 시안과 같은 예시(땅콩·지민).
 */

import type { AnalysisHistoryRow } from '../../dogs/[id]/analyses/AnalysesHistoryView'
import type { VetReportData } from '../../dogs/[id]/vet-report/VetReportView'
import type { YearInReviewData } from '../../dogs/[id]/year-in-review/YearInReviewView'

export const FX_DOG_ID = '00000000-0000-4000-8000-000000000001'

const GUIDE = 'NRC2006+AAFCO2024+FEDIAF2024+WSAVA2021+IRIS2019+KFA'

function row(over: Partial<AnalysisHistoryRow> & Pick<AnalysisHistoryRow, 'id' | 'created_at' | 'mer' | 'rer' | 'feed_g'>): AnalysisHistoryRow {
  return {
    stage: '성견 (유지기)',
    bcs_label: 'BCS 4-5',
    bcs_score: 5,
    protein_pct: 47,
    fat_pct: 20,
    guideline_version: GUIDE,
    carb_pct: 22,
    fiber_pct: 3,
    vet_consult_recommended: false,
    next_review_date: null,
    commentary: null,
    supplements: null,
    source: 'survey',
    isGrowthAuto: false,
    ...over,
  }
}

export const HISTORY_ROWS: AnalysisHistoryRow[] = [
  row({ id: 'a3', created_at: '2026-09-27T10:00:00+09:00', mer: 600, rer: 429, feed_g: 511 }),
  row({ id: 'a2', created_at: '2026-06-02T10:00:00+09:00', mer: 613, rer: 437.9, feed_g: 467 }),
  row({ id: 'a1', created_at: '2026-02-10T10:00:00+09:00', mer: 592, rer: 422.8, feed_g: 451 }),
]

/** 진료 보고서(시안 D22) — 약 하나(복약 주기 저장 값 daily → 화면 "매일"). */
export const VET_REPORT: VetReportData = {
  dog: { name: '땅콩', breed: '셰틀랜드 시프도그', weight: 11.2, age_value: 3, age_unit: 'years', gender: 'female', neutered: true },
  owner: { name: '지민', phone: '010-0000-0000' },
  answers: { bcsExact: 5 },
  surveyCreatedAt: '2026-09-30T10:00:00+09:00',
  analysis: {
    id: 'a3',
    created_at: '2026-09-30T10:00:00+09:00',
    mer: 600,
    rer: 429,
    stage: '성견 (유지기)',
    bcs_label: 'BCS 4-5',
    bcs_score: 5,
    feed_g: 511,
    protein_pct: 47,
    fat_pct: 20,
    carb_pct: 22,
    fiber_pct: 3,
    vet_consult_recommended: false,
    next_review_date: null,
    commentary: null,
  },
  weights: [
    { measured_at: '2026-09-21T09:00:00+09:00', weight: 11.2 },
    { measured_at: '2026-09-28T09:00:00+09:00', weight: 11.1 },
    { measured_at: '2026-10-05T09:00:00+09:00', weight: 11.2 },
  ],
  meds: [{ id: 'm1', name: '피부 연고', dose: '얇게 한 번', schedule: 'daily', time: '21:00', note: '앞발 발가락 사이', enabled: true }],
  issuedAt: '2026-10-07T10:00:00+09:00',
}

/** 연말 결산(시안 A09) — 함께한 247일. */
export const YEAR_REVIEW: YearInReviewData = {
  dogId: FX_DOG_ID,
  dogName: '땅콩',
  daysIn: 247,
  isFullYear: false,
  analysisCount: 3,
  weightCount: 3,
  checkinCount: 12,
  diaryCount: 4,
  weightStart: 11.2,
  weightEnd: 11.2,
  weightDelta: 0,
  weightMin: 11.1,
  weightMax: 11.2,
}

/** 건강 리포트(시안 A11). */
export const REPORTS = {
  monthLabel: '2026년 10월',
  weightCount: 1,
  diaryCount: 2,
  analysisCount: 0,
  dogs: [
    { id: FX_DOG_ID, name: '땅콩' },
    { id: '00000000-0000-4000-8000-000000000002', name: '보리' },
  ],
}
