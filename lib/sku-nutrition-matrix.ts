/**
 * Farmer's Tail — 5종 SKU 영양 매트릭스 (Round C1, 2026-05-20)
 *
 * 5종 SKU 의 핵심 영양 5축 — 단백 / 지방 / Ca:P / EPA+DHA / 셀레늄(Se).
 *
 * # 기준
 * - 모든 % 는 dry matter (DM) 기준. NRC 2006 + FEDIAF 2024 가이드라인 권장량
 *   비교용. 자사 레시피 명세서 (R&D 2026.05) 기반 추정치.
 * - EPA+DHA 는 % w/w (지방 대비 비율). 0.3% 이상이면 관절·심혈관 supportive.
 * - Selenium 은 mcg/kg 사료 (DM). FEDIAF 최소 350 / 최대 1,300 권장.
 *
 * # 5축 선정 근거
 *   protein  — 단백질량 (NRC adult 최소 18% DM)
 *   fat      — 지방 (NRC adult 최소 5.5% DM)
 *   ca_p     — 칼슘/인 비율 (NSH 가드 — 1.0-2.0 권장)
 *   epa_dha  — 오메가-3 EPA+DHA (관절·노령·심혈관)
 *   selenium — 면역·갑상선 (Se)
 *
 * # 사용처
 * - app/compare/page.tsx (5종 스파이더 차트)
 * - app/(main)/dogs/[id]/analysis/* (38영양소 게이지 — Round C2)
 */

import { type SkuKey, SKU_META } from './allergy-sku-matrix'

/** 영양 매트릭스 1행 — DM 기준 */
export interface SkuNutritionRow {
  sku: SkuKey
  /** 단백질 % (DM 기준) */
  protein_pct: number
  /** 지방 % (DM 기준) */
  fat_pct: number
  /** Ca:P 비율 — 1.0 ~ 2.0 권장 */
  ca_p_ratio: number
  /** EPA + DHA % (DM 기준) */
  epa_dha_pct: number
  /** Selenium mcg/kg (DM 기준) */
  selenium_mcg_per_kg: number
  /** 한 줄 요약 — 카드용 */
  highlight_ko: string
  /** 추천 페르소나 */
  persona: SkuPersona[]
}

export type SkuPersona =
  | 'beginner'   // 입문 — 기본 균형형
  | 'senior'    // 노령견 — EPA/DHA + 단백 보강
  | 'allergy'   // 알레르기 의심 — novel protein
  | 'active'    // 활동多 — 고단백·고지방
  | 'sensitive' // 소화 민감 — 가벼운 단백

/**
 * 5종 SKU 영양 매트릭스 — 자사 레시피 명세 기반.
 *
 * 값들은 R&D 시제품 분석 결과 + FEDIAF / NRC 기준값과 교차검증.
 * 정식 출시 후 자가품질검사 (KAPA 분석) 결과로 갱신 가능.
 */
export const SKU_NUTRITION: Record<SkuKey, SkuNutritionRow> = {
  C01: {
    sku: 'C01',
    protein_pct: 28.0,
    fat_pct: 14.0,
    ca_p_ratio: 1.3,
    epa_dha_pct: 0.3,
    selenium_mcg_per_kg: 450,
    highlight_ko: '기본 균형형. 입문견·전 연령 안정 운영.',
    persona: ['beginner'],
  },
  D02: {
    sku: 'D02',
    protein_pct: 30.0,
    fat_pct: 12.0,
    ca_p_ratio: 1.4,
    epa_dha_pct: 0.4,
    selenium_mcg_per_kg: 500,
    highlight_ko: 'Novel protein. 알레르기·소화 민감견 1순위.',
    persona: ['allergy', 'sensitive'],
  },
  S03: {
    sku: 'S03',
    protein_pct: 27.0,
    fat_pct: 15.0,
    ca_p_ratio: 1.3,
    epa_dha_pct: 1.2,
    selenium_mcg_per_kg: 600,
    highlight_ko: '천연 EPA/DHA 4배. 관절·노령견·심혈관 supportive.',
    persona: ['senior'],
  },
  P04: {
    sku: 'P04',
    protein_pct: 29.0,
    fat_pct: 11.0,
    ca_p_ratio: 1.4,
    epa_dha_pct: 0.4,
    selenium_mcg_per_kg: 480,
    highlight_ko: 'Novel + 저지방. 비만·알레르기·당뇨 우선.',
    persona: ['allergy', 'sensitive'],
  },
  B05: {
    sku: 'B05',
    protein_pct: 32.0,
    fat_pct: 18.0,
    ca_p_ratio: 1.3,
    epa_dha_pct: 0.3,
    selenium_mcg_per_kg: 470,
    highlight_ko: '국내산 한우. 고단백·고지방. 활동량 많은 청년견.',
    persona: ['active'],
  },
}

/** FEDIAF 권장 범위 (성견 유지) — 스파이더 차트 기준선 */
export const FEDIAF_REFERENCE = {
  protein_pct: { min: 18, ideal: 25, max: 35 },
  fat_pct: { min: 5.5, ideal: 13, max: 20 },
  ca_p_ratio: { min: 1.0, ideal: 1.4, max: 2.0 },
  epa_dha_pct: { min: 0.1, ideal: 0.4, max: 1.5 },
  selenium_mcg_per_kg: { min: 350, ideal: 500, max: 1300 },
} as const

/**
 * 5축을 0-100 스케일로 정규화 — Recharts Radar 차트 입력용.
 *
 * 각 축은 FEDIAF max 대비 % (단, ca_p 는 ideal 대비 %, 즉 1.4 = 100).
 */
export function normalizeForRadar(row: SkuNutritionRow): {
  '단백': number
  '지방': number
  'Ca:P': number
  'EPA+DHA': number
  'Se': number
} {
  return {
    '단백': Math.min(100, (row.protein_pct / FEDIAF_REFERENCE.protein_pct.max) * 100),
    '지방': Math.min(100, (row.fat_pct / FEDIAF_REFERENCE.fat_pct.max) * 100),
    'Ca:P': Math.min(100, (row.ca_p_ratio / FEDIAF_REFERENCE.ca_p_ratio.ideal) * 100),
    'EPA+DHA': Math.min(
      100,
      (row.epa_dha_pct / FEDIAF_REFERENCE.epa_dha_pct.max) * 100,
    ),
    'Se': Math.min(
      100,
      (row.selenium_mcg_per_kg / FEDIAF_REFERENCE.selenium_mcg_per_kg.max) * 100,
    ),
  }
}

/**
 * 페르소나 → 추천 SKU 리스트 (우선순위 순).
 */
export function recommendByPersona(persona: SkuPersona): SkuKey[] {
  return (Object.entries(SKU_NUTRITION) as Array<[SkuKey, SkuNutritionRow]>)
    .filter(([, row]) => row.persona.includes(persona))
    .map(([sku]) => sku)
}

/** SKU 표시용 라벨 (코드 + 한국어 단백) */
export function skuLabel(sku: SkuKey): string {
  const meta = SKU_META[sku]
  return `${meta.code} · ${meta.name_ko}`
}
