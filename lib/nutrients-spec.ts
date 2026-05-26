/**
 * 38 영양소 표준 spec — AAFCO 2024 Dog Food Nutrient Profiles
 * (Adult Maintenance) 기반. 라벨/시뮬레이터 input 의 ground truth.
 *
 * # 분류
 *   crude     (5)  — 단백/지방/섬유/회분/수분
 *   energy    (1)  — ME kcal/kg
 *   amino     (10) — 필수 아미노산
 *   fatty     (2)  — 필수 지방산
 *   minerals  (12)
 *   vitamins  (8)
 *
 *   합계 38 — XL-1 (#19) 출원서 영양 매칭 알고리즘 input 정밀화.
 *
 * # min/max 출처
 *   AAFCO 2024 Official Publication, Dog Food Nutrient Profiles
 *   (Maintenance, DM basis). Growth (Puppy) 는 별도 필드 없이 algorithm
 *   분기 시 1.4~2.5x scale (대형견 큰 puppy 보호) 적용.
 *
 * # nutrition_facts jsonb 키
 *   본 spec 의 `key` 그대로 사용. 기존 (R5 이전) protein_pct 등 short
 *   key 와 호환 위해 lib/nutrients-migrate.ts 로 마이그레이션 helper 제공.
 */

export type NutrientCategory =
  | 'crude'
  | 'energy'
  | 'amino'
  | 'fatty'
  | 'minerals'
  | 'vitamins'

export interface NutrientSpec {
  key: string
  label: string
  /** 단위 — 화면 표시용 */
  unit: '%' | 'kcal/kg' | 'mg/kg' | 'IU/kg'
  category: NutrientCategory
  /** AAFCO Adult Maintenance 최소 (DM basis) */
  aafcoMin?: number
  /** AAFCO 최대 (있는 경우만) */
  aafcoMax?: number
  /** 짧은 설명 (admin tooltip) */
  hint?: string
}

export const NUTRIENTS: NutrientSpec[] = [
  // ─── crude (5) ───
  { key: 'crude_protein_pct',    label: '조단백',   unit: '%', category: 'crude', aafcoMin: 18,    hint: '단백질 (조단백). 성견 최소 18%, 자견 22.5%' },
  { key: 'crude_fat_pct',        label: '조지방',   unit: '%', category: 'crude', aafcoMin: 5.5,   hint: '지방 (조지방). 성견 최소 5.5%' },
  { key: 'crude_fiber_pct',      label: '조섬유',   unit: '%', category: 'crude',                  hint: '소화에 도움 (장점막 자극)' },
  { key: 'crude_ash_pct',        label: '조회분',   unit: '%', category: 'crude',                  hint: '미네랄 합계 추정' },
  { key: 'moisture_pct',         label: '수분',     unit: '%', category: 'crude',                  hint: '드라이 푸드 보통 8~12%' },

  // ─── energy (1) ───
  { key: 'metabolizable_energy_kcal_per_kg', label: '대사 에너지', unit: 'kcal/kg', category: 'energy', hint: 'ME — 급여량 계산의 기준 (MER ÷ ME × 1000 = 일일 g)' },

  // ─── amino (10) ───
  { key: 'arginine_pct',         label: '아르기닌',     unit: '%', category: 'amino', aafcoMin: 0.51 },
  { key: 'histidine_pct',        label: '히스티딘',     unit: '%', category: 'amino', aafcoMin: 0.19 },
  { key: 'isoleucine_pct',       label: '이소류신',     unit: '%', category: 'amino', aafcoMin: 0.38 },
  { key: 'leucine_pct',          label: '류신',         unit: '%', category: 'amino', aafcoMin: 0.68 },
  { key: 'lysine_pct',           label: '라이신',       unit: '%', category: 'amino', aafcoMin: 0.63 },
  { key: 'methionine_pct',       label: '메티오닌',     unit: '%', category: 'amino', aafcoMin: 0.33 },
  { key: 'phenylalanine_pct',    label: '페닐알라닌',   unit: '%', category: 'amino', aafcoMin: 0.45 },
  { key: 'threonine_pct',        label: '트레오닌',     unit: '%', category: 'amino', aafcoMin: 0.48 },
  { key: 'tryptophan_pct',       label: '트립토판',     unit: '%', category: 'amino', aafcoMin: 0.16 },
  { key: 'valine_pct',           label: '발린',         unit: '%', category: 'amino', aafcoMin: 0.49 },

  // ─── fatty (2) ───
  { key: 'linoleic_acid_pct',          label: '리놀레산 (LA)',        unit: '%', category: 'fatty', aafcoMin: 1.0, hint: 'ω-6 필수' },
  { key: 'alpha_linolenic_acid_pct',   label: '알파-리놀렌산 (ALA)',  unit: '%', category: 'fatty',               hint: 'ω-3 필수 (EPA/DHA 전구체)' },

  // ─── minerals (12) ───
  { key: 'calcium_pct',          label: '칼슘 (Ca)',     unit: '%',     category: 'minerals', aafcoMin: 0.5,  aafcoMax: 2.5, hint: '대형 puppy 1.2~1.8' },
  { key: 'phosphorus_pct',       label: '인 (P)',        unit: '%',     category: 'minerals', aafcoMin: 0.4,  aafcoMax: 1.6 },
  { key: 'potassium_pct',        label: '칼륨 (K)',      unit: '%',     category: 'minerals', aafcoMin: 0.6 },
  { key: 'sodium_pct',           label: '나트륨 (Na)',   unit: '%',     category: 'minerals', aafcoMin: 0.08 },
  { key: 'chloride_pct',         label: '염소 (Cl)',     unit: '%',     category: 'minerals', aafcoMin: 0.12 },
  { key: 'magnesium_pct',        label: '마그네슘 (Mg)', unit: '%',     category: 'minerals', aafcoMin: 0.06 },
  { key: 'iron_mg_per_kg',       label: '철 (Fe)',       unit: 'mg/kg', category: 'minerals', aafcoMin: 40 },
  { key: 'copper_mg_per_kg',     label: '구리 (Cu)',     unit: 'mg/kg', category: 'minerals', aafcoMin: 7.3 },
  { key: 'manganese_mg_per_kg',  label: '망간 (Mn)',     unit: 'mg/kg', category: 'minerals', aafcoMin: 5.0 },
  { key: 'zinc_mg_per_kg',       label: '아연 (Zn)',     unit: 'mg/kg', category: 'minerals', aafcoMin: 80 },
  { key: 'iodine_mg_per_kg',     label: '요오드 (I)',    unit: 'mg/kg', category: 'minerals', aafcoMin: 1.0, aafcoMax: 11 },
  { key: 'selenium_mg_per_kg',   label: '셀레늄 (Se)',   unit: 'mg/kg', category: 'minerals', aafcoMin: 0.35, aafcoMax: 2.0 },

  // ─── vitamins (8) ───
  { key: 'vitamin_a_iu_per_kg',  label: '비타민 A',    unit: 'IU/kg',  category: 'vitamins', aafcoMin: 5000, aafcoMax: 250000 },
  { key: 'vitamin_d_iu_per_kg',  label: '비타민 D',    unit: 'IU/kg',  category: 'vitamins', aafcoMin: 500,  aafcoMax: 3000 },
  { key: 'vitamin_e_iu_per_kg',  label: '비타민 E',    unit: 'IU/kg',  category: 'vitamins', aafcoMin: 50 },
  { key: 'thiamine_mg_per_kg',   label: '티아민 (B1)', unit: 'mg/kg',  category: 'vitamins', aafcoMin: 2.25 },
  { key: 'riboflavin_mg_per_kg', label: '리보플라빈 (B2)', unit: 'mg/kg', category: 'vitamins', aafcoMin: 5.2 },
  { key: 'niacin_mg_per_kg',     label: '니아신 (B3)', unit: 'mg/kg',  category: 'vitamins', aafcoMin: 13.6 },
  { key: 'pyridoxine_mg_per_kg', label: '피리독신 (B6)', unit: 'mg/kg', category: 'vitamins', aafcoMin: 1.5 },
  { key: 'choline_mg_per_kg',    label: '콜린',        unit: 'mg/kg',  category: 'vitamins', aafcoMin: 1360 },
]

// ─── sanity ───
// 38 nutrients invariant. 본 파일은 build-time literal 이라 dev 만 확인.
if (process.env.NODE_ENV !== 'production' && NUTRIENTS.length !== 38) {
  console.warn(`[nutrients-spec] expected 38 entries, got ${NUTRIENTS.length}`)
}

/**
 * 카테고리별 그룹화 (admin UI 섹션 분리).
 */
export function nutrientsByCategory(): Record<NutrientCategory, NutrientSpec[]> {
  const out: Record<NutrientCategory, NutrientSpec[]> = {
    crude: [], energy: [], amino: [], fatty: [], minerals: [], vitamins: [],
  }
  for (const n of NUTRIENTS) out[n.category].push(n)
  return out
}

/**
 * AAFCO 충족 여부 평가. 미달/초과 항목 리스트 반환.
 *
 * @param values nutrition_facts jsonb 값 (key → number).
 * @returns 미달 (below min) / 초과 (above max) 영양소 spec 배열.
 */
export function evaluateAafcoCompliance(
  values: Record<string, number | null | undefined>,
): { below: NutrientSpec[]; above: NutrientSpec[]; missing: NutrientSpec[] } {
  const below: NutrientSpec[] = []
  const above: NutrientSpec[] = []
  const missing: NutrientSpec[] = []
  for (const n of NUTRIENTS) {
    const v = values[n.key]
    if (v == null) {
      // min 있는 항목인데 값 없으면 missing
      if (n.aafcoMin != null) missing.push(n)
      continue
    }
    if (n.aafcoMin != null && v < n.aafcoMin) below.push(n)
    if (n.aafcoMax != null && v > n.aafcoMax) above.push(n)
  }
  return { below, above, missing }
}

export const CATEGORY_LABELS: Record<NutrientCategory, string> = {
  crude: '일반 성분',
  energy: '에너지',
  amino: '필수 아미노산',
  fatty: '필수 지방산',
  minerals: '미네랄',
  vitamins: '비타민',
}
