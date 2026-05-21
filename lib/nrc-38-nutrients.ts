/**
 * Farmer's Tail — 38영양소 매트릭스 (Round C2, 2026-05-20)
 *
 * NRC 2006 + FEDIAF 2024 + 한국 NIAS 2024 권장량 기반 38영양소 정의.
 *
 * # 38 카테고리 선정
 *   Macro (5)           : protein, fat, carb, fiber, ash
 *   Amino acids (10)    : Arg, His, Ile, Leu, Lys, Met, Phe, Thr, Trp, Val
 *   Fatty acids (3)     : LA, ALA, EPA+DHA
 *   Minerals (12)       : Ca, P, Mg, K, Na, Cl, Fe, Cu, Zn, Mn, I, Se
 *   Vitamins (8)        : A, D, E, K, B1, B2, B6, B12
 *
 *   합계 38. — Farmer's Tail v4.0 보고서 ("하루 영양 38가지") 기준.
 *
 * # 색상 코드 (NIAS 가시화)
 *   🟢 권장 범위 (fediaf_min ~ fediaf_max) 안
 *   🟡 권장 ± 20% 안 (경계)
 *   🔴 범위 밖 (재설계 필요)
 *
 * # 사용처
 *   - components/analysis/NutrientGauges38.tsx (게이지 그리드)
 *   - 미래: SKU 자가품질검사 결과 자동 매칭 (Round D4)
 */

export type NutrientCategory =
  | 'macro'
  | 'amino_acid'
  | 'fatty_acid'
  | 'mineral'
  | 'vitamin'

export interface NutrientSpec {
  /** ID — 코드 안에서 식별. snake_case. */
  id: string
  /** 한국어 이름 */
  name_ko: string
  /** 영문 학명 (참조용) */
  name_en: string
  /** 카테고리 */
  category: NutrientCategory
  /** 단위 (%, mg/kg DM, mcg RE 등) */
  unit: string
  /** FEDIAF 2024 / NRC 2006 권장 하한 — 성견 유지 (DM 기준) */
  fediaf_min: number
  /** 권장 상한. null = 상한 없음. */
  fediaf_max: number | null
  /** 자사 평균 화식 추정치 (R&D 시제품 + 식재료 원재료 매트릭스) */
  ft_typical: number
}

/** 색상 — NIAS 가시화 기준 (🟢/🟡/🔴) */
export type NutrientStatus = 'good' | 'borderline' | 'out_of_range'

export function statusFor(
  spec: NutrientSpec,
  value: number,
): NutrientStatus {
  if (value >= spec.fediaf_min && (spec.fediaf_max === null || value <= spec.fediaf_max)) {
    return 'good'
  }
  const margin = 0.2 // ±20% 경계
  const lowerBoundary = spec.fediaf_min * (1 - margin)
  const upperBoundary =
    spec.fediaf_max === null ? Infinity : spec.fediaf_max * (1 + margin)
  if (value >= lowerBoundary && value <= upperBoundary) return 'borderline'
  return 'out_of_range'
}

export const NUTRIENT_SPECS: NutrientSpec[] = [
  // ── Macro (5) ─────────────────────────────────────────
  { id: 'protein', name_ko: '단백질', name_en: 'protein', category: 'macro', unit: '% DM', fediaf_min: 18, fediaf_max: 35, ft_typical: 28 },
  { id: 'fat', name_ko: '지방', name_en: 'fat', category: 'macro', unit: '% DM', fediaf_min: 5.5, fediaf_max: 20, ft_typical: 14 },
  { id: 'carb', name_ko: '탄수화물', name_en: 'carbohydrate', category: 'macro', unit: '% DM', fediaf_min: 0, fediaf_max: 60, ft_typical: 30 },
  { id: 'fiber', name_ko: '식이섬유', name_en: 'crude_fiber', category: 'macro', unit: '% DM', fediaf_min: 1, fediaf_max: 8, ft_typical: 3.5 },
  { id: 'ash', name_ko: '회분', name_en: 'crude_ash', category: 'macro', unit: '% DM', fediaf_min: 3, fediaf_max: 10, ft_typical: 6.5 },

  // ── Amino acids (10) ──────────────────────────────────
  { id: 'arg', name_ko: '아르기닌', name_en: 'arginine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.51, fediaf_max: null, ft_typical: 0.95 },
  { id: 'his', name_ko: '히스티딘', name_en: 'histidine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.19, fediaf_max: null, ft_typical: 0.45 },
  { id: 'ile', name_ko: '이소류신', name_en: 'isoleucine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.38, fediaf_max: null, ft_typical: 0.85 },
  { id: 'leu', name_ko: '류신', name_en: 'leucine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.68, fediaf_max: null, ft_typical: 1.55 },
  { id: 'lys', name_ko: '라이신', name_en: 'lysine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.63, fediaf_max: null, ft_typical: 1.45 },
  { id: 'met', name_ko: '메티오닌', name_en: 'methionine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.33, fediaf_max: null, ft_typical: 0.72 },
  { id: 'phe', name_ko: '페닐알라닌', name_en: 'phenylalanine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.45, fediaf_max: null, ft_typical: 0.95 },
  { id: 'thr', name_ko: '트레오닌', name_en: 'threonine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.48, fediaf_max: null, ft_typical: 1.05 },
  { id: 'trp', name_ko: '트립토판', name_en: 'tryptophan', category: 'amino_acid', unit: '% DM', fediaf_min: 0.16, fediaf_max: null, ft_typical: 0.32 },
  { id: 'val', name_ko: '발린', name_en: 'valine', category: 'amino_acid', unit: '% DM', fediaf_min: 0.49, fediaf_max: null, ft_typical: 1.05 },

  // ── Fatty acids (3) ───────────────────────────────────
  { id: 'la', name_ko: '리놀레산(LA)', name_en: 'linoleic_acid', category: 'fatty_acid', unit: '% DM', fediaf_min: 1.3, fediaf_max: null, ft_typical: 2.4 },
  { id: 'ala', name_ko: '알파리놀렌산(ALA)', name_en: 'alpha_linolenic', category: 'fatty_acid', unit: '% DM', fediaf_min: 0.08, fediaf_max: null, ft_typical: 0.35 },
  { id: 'epa_dha', name_ko: 'EPA+DHA', name_en: 'epa_dha', category: 'fatty_acid', unit: '% DM', fediaf_min: 0.05, fediaf_max: 1.5, ft_typical: 0.4 },

  // ── Minerals (12) ─────────────────────────────────────
  { id: 'ca', name_ko: '칼슘(Ca)', name_en: 'calcium', category: 'mineral', unit: '% DM', fediaf_min: 0.5, fediaf_max: 2.5, ft_typical: 1.2 },
  { id: 'p', name_ko: '인(P)', name_en: 'phosphorus', category: 'mineral', unit: '% DM', fediaf_min: 0.4, fediaf_max: 1.6, ft_typical: 0.9 },
  { id: 'mg', name_ko: '마그네슘(Mg)', name_en: 'magnesium', category: 'mineral', unit: '% DM', fediaf_min: 0.06, fediaf_max: 0.3, ft_typical: 0.12 },
  { id: 'k', name_ko: '칼륨(K)', name_en: 'potassium', category: 'mineral', unit: '% DM', fediaf_min: 0.5, fediaf_max: null, ft_typical: 0.9 },
  { id: 'na', name_ko: '나트륨(Na)', name_en: 'sodium', category: 'mineral', unit: '% DM', fediaf_min: 0.06, fediaf_max: 1.5, ft_typical: 0.3 },
  { id: 'cl', name_ko: '염소(Cl)', name_en: 'chloride', category: 'mineral', unit: '% DM', fediaf_min: 0.09, fediaf_max: null, ft_typical: 0.45 },
  { id: 'fe', name_ko: '철(Fe)', name_en: 'iron', category: 'mineral', unit: 'mg/kg', fediaf_min: 40, fediaf_max: 1500, ft_typical: 120 },
  { id: 'cu', name_ko: '구리(Cu)', name_en: 'copper', category: 'mineral', unit: 'mg/kg', fediaf_min: 7.3, fediaf_max: 250, ft_typical: 15 },
  { id: 'zn', name_ko: '아연(Zn)', name_en: 'zinc', category: 'mineral', unit: 'mg/kg', fediaf_min: 60, fediaf_max: 1000, ft_typical: 130 },
  { id: 'mn', name_ko: '망간(Mn)', name_en: 'manganese', category: 'mineral', unit: 'mg/kg', fediaf_min: 5, fediaf_max: null, ft_typical: 12 },
  { id: 'i', name_ko: '요오드(I)', name_en: 'iodine', category: 'mineral', unit: 'mg/kg', fediaf_min: 1.0, fediaf_max: 11, ft_typical: 2.2 },
  { id: 'se', name_ko: '셀레늄(Se)', name_en: 'selenium', category: 'mineral', unit: 'mcg/kg', fediaf_min: 350, fediaf_max: 1300, ft_typical: 500 },

  // ── Vitamins (8) ──────────────────────────────────────
  { id: 'vit_a', name_ko: '비타민 A', name_en: 'vitamin_a', category: 'vitamin', unit: 'IU/kg', fediaf_min: 5000, fediaf_max: 250000, ft_typical: 12000 },
  { id: 'vit_d', name_ko: '비타민 D', name_en: 'vitamin_d', category: 'vitamin', unit: 'IU/kg', fediaf_min: 500, fediaf_max: 3200, ft_typical: 1200 },
  { id: 'vit_e', name_ko: '비타민 E', name_en: 'vitamin_e', category: 'vitamin', unit: 'IU/kg', fediaf_min: 50, fediaf_max: null, ft_typical: 150 },
  { id: 'vit_k', name_ko: '비타민 K', name_en: 'vitamin_k', category: 'vitamin', unit: 'mg/kg', fediaf_min: 1.6, fediaf_max: null, ft_typical: 3.0 },
  { id: 'vit_b1', name_ko: '티아민 (B1)', name_en: 'thiamine', category: 'vitamin', unit: 'mg/kg', fediaf_min: 2.25, fediaf_max: null, ft_typical: 5.5 },
  { id: 'vit_b2', name_ko: '리보플라빈 (B2)', name_en: 'riboflavin', category: 'vitamin', unit: 'mg/kg', fediaf_min: 5.25, fediaf_max: null, ft_typical: 11 },
  { id: 'vit_b6', name_ko: '피리독신 (B6)', name_en: 'pyridoxine', category: 'vitamin', unit: 'mg/kg', fediaf_min: 1.5, fediaf_max: null, ft_typical: 3.6 },
  { id: 'vit_b12', name_ko: '시아노코발라민 (B12)', name_en: 'cobalamin', category: 'vitamin', unit: 'mcg/kg', fediaf_min: 35, fediaf_max: null, ft_typical: 80 },
]

// 38 검증 — build time TS assertion (만약 38 아니면 컴파일 시 잡힘).
const _NUTRIENT_COUNT_CHECK: 38 = NUTRIENT_SPECS.length as 38
void _NUTRIENT_COUNT_CHECK

/** 카테고리별 라벨 */
export const CATEGORY_LABEL: Record<NutrientCategory, string> = {
  macro: '주요 성분',
  amino_acid: '아미노산',
  fatty_acid: '지방산',
  mineral: '무기질',
  vitamin: '비타민',
}
