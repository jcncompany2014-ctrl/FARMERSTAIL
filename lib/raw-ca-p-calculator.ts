/**
 * Farmer's Tail — 자가 raw 식재료 Ca:P 비율 계산기 (Round E1, 2026-05-20)
 *
 * 사용자가 자기집에서 만든 raw / 화식을 자사 제품과 함께 급여할 때 칼슘·인
 * 비율 (Ca:P) 가 위험 범위인지 자동 판정.
 *
 * # 위험 기준
 *   Ca:P < 1.0  → NSH (영양성 이차 상피소체 항진증) risk
 *                  부갑상선 항진 → 골다공증, 자견은 골격 기형
 *   Ca:P > 2.0  → 칼슘 과잉 — 자견 골격 발달 저해 (FEDIAF Growth)
 *   1.0 ~ 2.0    → 안전 범위
 *
 * # 근거
 *   - Krook 1971/2010 — 고기 단독 급여 시 NSH 다발
 *   - FEDIAF 2024 성견 Ca:P 1.0 ~ 2.0 권장
 *   - NRC 2006 자견 Ca:P 1.0 ~ 1.6 권장
 *
 * # 데이터
 *   USDA FoodData Central 평균치 + 한국 식품영양성분 DB 교차검증. mg/100g.
 *
 * # 사용처
 *   - components/raw/RawFeedCalculator.tsx (사용자 폼)
 *   - 미래 — 사용자 raw 입력 → 자사 화식 보완 추천 (Ca 보강 제품)
 */

export interface IngredientCaP {
  /** ID — snake_case */
  id: string
  /** 한국어 이름 */
  name_ko: string
  /** 카테고리 */
  category: 'meat' | 'organ' | 'bone' | 'fish' | 'egg' | 'vegetable' | 'supplement'
  /** Ca mg/100g */
  ca_mg: number
  /** P mg/100g */
  p_mg: number
  /** 메모 (조리/가공 가정) */
  note?: string
}

/**
 * 한국에서 자주 사용하는 raw 식재료 (16종). USDA / 한국 식품영양성분 DB.
 * 데이터 정확도 우선보다 흔한 사용 케이스 cover 가 목적.
 */
export const RAW_INGREDIENTS: IngredientCaP[] = [
  // 살코기 — 인 多, 칼슘 거의 0
  { id: 'chicken_breast', name_ko: '닭가슴살', category: 'meat', ca_mg: 11, p_mg: 196 },
  { id: 'chicken_thigh', name_ko: '닭다리살', category: 'meat', ca_mg: 12, p_mg: 188 },
  { id: 'beef_lean', name_ko: '소 살코기', category: 'meat', ca_mg: 12, p_mg: 215 },
  { id: 'pork_lean', name_ko: '돼지 살코기', category: 'meat', ca_mg: 7, p_mg: 226 },
  { id: 'duck_meat', name_ko: '오리고기', category: 'meat', ca_mg: 11, p_mg: 203 },

  // 내장 — 인 매우 多
  { id: 'beef_liver', name_ko: '소 간', category: 'organ', ca_mg: 6, p_mg: 387 },
  { id: 'chicken_liver', name_ko: '닭 간', category: 'organ', ca_mg: 11, p_mg: 297 },

  // 뼈 — 칼슘 多
  { id: 'chicken_neck_with_bone', name_ko: '닭목뼈 (RMB)', category: 'bone', ca_mg: 880, p_mg: 670, note: '뼈 포함 raw meaty bone' },
  { id: 'chicken_feet', name_ko: '닭발', category: 'bone', ca_mg: 90, p_mg: 165 },
  { id: 'duck_neck_with_bone', name_ko: '오리목뼈 (RMB)', category: 'bone', ca_mg: 850, p_mg: 640 },

  // 생선 — 인 多, 칼슘 다양
  { id: 'salmon_filet', name_ko: '연어 살', category: 'fish', ca_mg: 9, p_mg: 245 },
  { id: 'sardine_with_bone', name_ko: '정어리 (뼈 포함)', category: 'fish', ca_mg: 382, p_mg: 490, note: '뼈 포함 통조림' },
  { id: 'mackerel', name_ko: '고등어', category: 'fish', ca_mg: 12, p_mg: 217 },

  // 계란
  { id: 'egg_whole', name_ko: '계란 (껍데기 제외)', category: 'egg', ca_mg: 56, p_mg: 198 },
  { id: 'eggshell_powder', name_ko: '계란껍데기 가루', category: 'supplement', ca_mg: 38000, p_mg: 50, note: '1티스푼 ≈ 1800mg Ca' },

  // 보조제
  { id: 'bone_meal', name_ko: '본밀 (뼈가루)', category: 'supplement', ca_mg: 25000, p_mg: 12500, note: '시판 보충제' },
]

export interface RawEntry {
  /** ingredient id */
  ingredient: string
  /** 일일 급여 g */
  grams_per_day: number
}

export interface CaPResult {
  /** 합산 Ca mg/일 */
  total_ca_mg: number
  /** 합산 P mg/일 */
  total_p_mg: number
  /** Ca:P 비율 */
  ratio: number
  /** 안전 등급 */
  level: 'safe' | 'borderline_high' | 'borderline_low' | 'nsh_risk' | 'excess'
  /** 한국어 메시지 */
  message_ko: string
  /** 사용자 입력 entry 별 detail (디버그·UI 표시용) */
  per_ingredient: Array<{
    ingredient: IngredientCaP
    grams: number
    ca_mg: number
    p_mg: number
  }>
}

/**
 * Ca:P 계산 + NSH 가드 판정.
 */
export function calculateCaPRatio(entries: RawEntry[]): CaPResult {
  let totalCa = 0
  let totalP = 0
  const perIngredient: CaPResult['per_ingredient'] = []

  for (const entry of entries) {
    const ing = RAW_INGREDIENTS.find((i) => i.id === entry.ingredient)
    if (!ing) continue
    const ca = (ing.ca_mg * entry.grams_per_day) / 100
    const p = (ing.p_mg * entry.grams_per_day) / 100
    totalCa += ca
    totalP += p
    perIngredient.push({
      ingredient: ing,
      grams: entry.grams_per_day,
      ca_mg: Math.round(ca),
      p_mg: Math.round(p),
    })
  }

  const ratio = totalP > 0 ? totalCa / totalP : 0

  let level: CaPResult['level']
  let message: string

  if (totalP === 0) {
    level = 'safe'
    message = '식재료를 추가해 보세요.'
  } else if (ratio < 1.0) {
    level = 'nsh_risk'
    message =
      `⚠️ Ca:P ${ratio.toFixed(2)} — 영양성 이차 상피소체 항진증(NSH) 위험. ` +
      `Krook 2010 — 고기 단독 급여 시 부갑상선 항진 + 골다공증. ` +
      `닭목뼈·계란껍데기 가루·본밀로 칼슘 보강 필요.`
  } else if (ratio < 1.2) {
    level = 'borderline_low'
    message =
      `Ca:P ${ratio.toFixed(2)} — 안전 범위 하한. 1.2~1.5 정도가 이상적이에요.`
  } else if (ratio <= 2.0) {
    level = 'safe'
    message = `Ca:P ${ratio.toFixed(2)} — ✅ FEDIAF 권장 안 (1.0~2.0).`
  } else if (ratio <= 2.5) {
    level = 'borderline_high'
    message =
      `Ca:P ${ratio.toFixed(2)} — 안전 범위 초과 약간. 자견은 골격 발달 저해 위험.`
  } else {
    level = 'excess'
    message =
      `⚠️ Ca:P ${ratio.toFixed(2)} — 칼슘 과잉. 자견 골격 발달 저해 (FEDIAF Growth). ` +
      `뼈·껍데기 가루 비중을 줄이세요.`
  }

  return {
    total_ca_mg: Math.round(totalCa),
    total_p_mg: Math.round(totalP),
    ratio: Math.round(ratio * 100) / 100,
    level,
    message_ko: message,
    per_ingredient: perIngredient,
  }
}
