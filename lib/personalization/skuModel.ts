/**
 * SKU 모델 — 추천 알고리즘 v2.0 단일 진실 소스 (SSOT).
 *
 * 라인 정체성을 **단백질 키**(chicken/duck/pork/beef/salmon)로 재정의.
 * 컨셉(체중관리 등)은 메타데이터. 에너지·영양 프로파일·페르소나·알레르기·
 * slug·케어목표를 한 곳에 통합 → lines.ts(FOOD_LINE_META) + allergy-sku-matrix
 * (SKU_META) + skuMap(LINE_TO_SLUG) 의 중복을 흡수한다.
 *
 * # 근거 (최종 마스터 레시피 v2.1, 2026-06)
 *  - kcal/100g: sheet7 as-fed 설계값 (닭130·오리150·돼지140·소160).
 *  - 영양 프로파일(%DM): sheet3 목표 × sheet7 검증 충족률.
 *    예) 닭 단백질 = 20.7(target) × 2.39(충족) ≈ 49.5%DM.
 *    Ca:P 비율이 레시피 명시값(닭1.11·오리1.22·돼지1.10·소1.23)과 일치 →
 *    유도 검증됨 (skuModel.test.ts).
 *  - omega3/omega6 는 레시피 미검증 항목 → USDA FoodData Central 추정
 *    (연어유 함량 차등 반영). vitD 는 레시피 검증값(target 63.5 × 충족률).
 *  - 알레르기: Mueller 2016 (BMC Vet Res 12:9), 교차반응 Bexley 2019 /
 *    Martín 2004.
 *
 * # 연어(salmon)
 *  제품 보류 (연어 60% 단독은 VitD 상한 초과 — 추후 시니어 라인 재설계).
 *  deferred=true. 프로파일은 출시 전 USDA 추정(레시피 미확정) — 실데이터
 *  확정 시 갱신. 추천에서는 skuMap.gateAvailability 가 제외(연어→오리 대체).
 */

/** 단백질 키 — 라인 정체성. allergy-sku-matrix 의 protein_en 과 통합. */
export type ProteinKey = 'chicken' | 'duck' | 'pork' | 'beef' | 'salmon'

/** 케어 목표 (설문). */
export type CareGoal =
  | 'weight_management'
  | 'skin_coat'
  | 'joint_senior'
  | 'allergy_avoid'
  | 'general_upgrade'

/** 구 라인 키 (v1 호환 — 알고리즘 내부 식별자). lines.ts FoodLine 과 동일. */
export type LegacyLine = 'basic' | 'weight' | 'skin' | 'premium' | 'joint'

/** SKU 영양 단면 (100g DM 기준, kcal 만 as-fed). */
export type SkuNutritionProfile = {
  /** as-fed kcal/100g (레시피 sheet7). */
  kcalPer100g: number
  /** 단백질 %DM. */
  proteinPctDM: number
  /** 지방 %DM (췌장염 fat-ceiling 룰 입력). */
  fatPctDM: number
  /** Ca %DM. */
  calciumPctDM: number
  /** P %DM. */
  phosphorusPctDM: number
  /** Na %DM (심장 저나트륨 검증). */
  sodiumPctDM: number
  /** EPA+DHA %DM (USDA 추정). */
  omega3PctDM: number
  /** omega-6 %DM (USDA 추정). */
  omega6PctDM: number
  /** vitamin D IU/100g DM (레시피 검증값). */
  vitaminDIuPer100gDM: number
}

export type SkuDef = {
  protein: ProteinKey
  /** 영문 표시명. */
  name: string
  /** 한국어 단백질명. */
  nameKo: string
  /** 대표 페르소나. */
  persona: string
  /** 컨셉(메타). */
  concept: string
  /** UI 부제 '닭 · 체중관리·항염'. */
  subtitle: string
  /** 한 줄 효능 (박스 카드). */
  benefit: string
  /** 컨셉 토핑. */
  topping: string
  /** 대표 제품 slug. */
  slug: string
  /** 구 라인 키 (마이그레이션/역호환 참조용). */
  legacyLine: LegacyLine
  /** 노블(novel) 단백질 여부 — 알레르기 회피 추천. */
  novel: boolean
  /** Mueller 2016 알레르기 유병률 (%). */
  muellerAllergyRate: number
  /** 즉시 0% 차단할 알레르기 라벨(한국어). */
  blockingAllergies: string[]
  /** IgE 교차반응 경고(차단 X, chip 만). */
  crossReactWith: string[]
  /** 이 SKU 가 1차로 서비스하는 케어목표 태그. */
  careGoalAffinity: CareGoal[]
  /** 영양 단면. */
  profile: SkuNutritionProfile
  /** 제품 보류(연어). 추천 게이트 제외. */
  deferred?: boolean
  /** UI 색상 토큰/hex. */
  color: string
}

/**
 * SKU SSOT. 키 = 단백질.
 * 프로파일 = 레시피 sheet3 목표 × sheet7 충족률 (Ca/P/Na/vitD/protein/fat),
 * omega 는 USDA 추정.
 */
export const SKU_MODEL: Record<ProteinKey, SkuDef> = {
  chicken: {
    protein: 'chicken',
    name: 'Chicken',
    nameKo: '닭',
    persona: '모찌',
    concept: '체중관리·항염',
    subtitle: '닭 · 체중관리·항염',
    benefit: '닭가슴살 저지방(4종 최저 지방) 115kcal + 강황',
    topping: '강황',
    slug: 'chicken-basic',
    // v2.0 ③-A: 닭 = weight 키 (임상 '다이어트 라인' 룰이 닭을 가리키게).
    legacyLine: 'weight',
    novel: false,
    muellerAllergyRate: 15.0,
    blockingAllergies: ['닭·칠면조'],
    crossReactWith: [],
    careGoalAffinity: ['weight_management', 'general_upgrade'],
    profile: {
      // 2026-07-11 검정 확정 kcal: 닭·돼지 115, 오리·소 120.
      kcalPer100g: 115,
      proteinPctDM: 49.5,
      fatPctDM: 19.1,
      calciumPctDM: 0.65,
      phosphorusPctDM: 0.584,
      sodiumPctDM: 0.179,
      omega3PctDM: 0.17,
      omega6PctDM: 3.3,
      vitaminDIuPer100gDM: 76,
    },
    color: 'var(--terracotta)',
  },
  duck: {
    protein: 'duck',
    name: 'Duck',
    nameKo: '오리',
    persona: '코코',
    concept: '알레르기·장건강',
    subtitle: '오리 · 알레르기·장건강',
    benefit: '노블 단백질, 닭/소 배제 + 사과 펙틴 장케어',
    topping: '사과',
    slug: 'duck-weight',
    // v2.0 ③-A: 오리 = basic 키 (노블/알레르기 라인).
    legacyLine: 'basic',
    novel: true,
    muellerAllergyRate: 0.5,
    blockingAllergies: ['오리'],
    crossReactWith: ['닭·칠면조'],
    careGoalAffinity: ['allergy_avoid'],
    profile: {
      kcalPer100g: 120, // 2026-07-11 검정 확정
      proteinPctDM: 40.6,
      fatPctDM: 27.5,
      calciumPctDM: 0.615,
      phosphorusPctDM: 0.501,
      sodiumPctDM: 0.193,
      omega3PctDM: 0.33,
      omega6PctDM: 3.3,
      vitaminDIuPer100gDM: 127,
    },
    color: 'var(--moss)',
  },
  pork: {
    protein: 'pork',
    name: 'Pork',
    nameKo: '돼지',
    persona: '토토',
    concept: '기호·신경 B1',
    subtitle: '돼지 · 기호·신경 케어',
    benefit: '돼지안심 + B1 압도적, 무 소화효소 (노견 친화)',
    topping: '무',
    slug: 'pork-joint',
    legacyLine: 'joint',
    novel: true,
    muellerAllergyRate: 2.0,
    blockingAllergies: ['돼지고기'],
    crossReactWith: [],
    careGoalAffinity: ['joint_senior'],
    profile: {
      kcalPer100g: 115, // 2026-07-11 검정 확정
      proteinPctDM: 45.1,
      fatPctDM: 21.8,
      calciumPctDM: 0.61,
      phosphorusPctDM: 0.561,
      sodiumPctDM: 0.14,
      omega3PctDM: 0.17,
      omega6PctDM: 5.0,
      vitaminDIuPer100gDM: 98,
    },
    color: '#C97F8E',
  },
  beef: {
    protein: 'beef',
    name: 'Beef',
    nameKo: '소',
    persona: '바람이',
    concept: '활력·프리미엄',
    subtitle: '소 · 활력·프리미엄 한우',
    benefit: '한우 목심 헴철·B12, 활동량 많은 견',
    topping: '블루베리',
    slug: 'beef-premium',
    legacyLine: 'premium',
    novel: false,
    muellerAllergyRate: 34.0,
    blockingAllergies: ['소고기', '양고기'],
    crossReactWith: ['양고기'],
    careGoalAffinity: ['general_upgrade'],
    profile: {
      kcalPer100g: 120, // 2026-07-11 검정 확정
      proteinPctDM: 38.7,
      fatPctDM: 28.7,
      calciumPctDM: 0.587,
      phosphorusPctDM: 0.478,
      sodiumPctDM: 0.155,
      omega3PctDM: 0.1,
      omega6PctDM: 1.7,
      vitaminDIuPer100gDM: 68,
    },
    color: '#9B5B5B',
  },
  salmon: {
    protein: 'salmon',
    name: 'Salmon',
    nameKo: '연어',
    persona: '시니어(예정)',
    concept: '피부·털 EPA/DHA',
    subtitle: '연어 · 피부·털 (준비중)',
    benefit: '오메가-3 자체 공급, 피모 윤기 (시니어 라인 예정)',
    topping: '—',
    slug: 'salmon-skin',
    legacyLine: 'skin',
    novel: true,
    muellerAllergyRate: 2.0,
    blockingAllergies: ['연어·생선', '흰살생선'],
    // Bexley 2019 (Vet Dermatol 30:25) — 어류 parvalbumin ↔ 닭/칠면조 IgE
    // 교차반응. 닭 알레르기견에게 연어 라인 제안 시 cross-react chip 경고
    // (연어 제품 출시 시 활성). 이전 [] → 닭알레르기견 무경고 갭이었음.
    crossReactWith: ['닭·칠면조'],
    careGoalAffinity: ['skin_coat'],
    // 제품 보류 — 프로파일은 출시 전 USDA 추정(레시피 미확정).
    deferred: true,
    profile: {
      kcalPer100g: 160,
      proteinPctDM: 26,
      fatPctDM: 16,
      calciumPctDM: 1.0,
      phosphorusPctDM: 0.8,
      sodiumPctDM: 0.35,
      omega3PctDM: 6.7,
      omega6PctDM: 1.7,
      vitaminDIuPer100gDM: 1200,
    },
    color: 'var(--gold)',
  },
}

/** 모든 단백질 — iteration 안정 순서. */
export const ALL_PROTEINS: ProteinKey[] = [
  'chicken',
  'duck',
  'pork',
  'beef',
  'salmon',
]

/** 케어 목표 → 1차 추천 단백질 (레시피 페르소나 기준). */
export const CARE_GOAL_PRIMARY: Record<CareGoal, ProteinKey> = {
  weight_management: 'chicken', // 닭 115kcal·최저 지방 19%DM (모찌)
  allergy_avoid: 'duck', // 노블 (코코)
  skin_coat: 'salmon', // 연어 (보류 시 게이트가 duck 대체)
  joint_senior: 'pork', // B1·노견 (토토)
  general_upgrade: 'chicken', // 균형 entry
}

/**
 * 구 라인 키 → 단백질.
 *
 * v2.0 ③-A 리바인드: weight=닭, basic=오리. 임상 룰(BCS·당뇨·췌장염 등)이
 * "weight 라인 = 저칼로리·저지방 다이어트" 전제로 작성돼 있어, 닭(115kcal·
 * 최저지방 19%DM)을 weight 키에 바인딩하면 **룰 무변경**으로
 * 레시피 정합(체중관리→닭, 췌장염 저지방→닭). basic 키 = 오리(노블/알레르기).
 */
export const LEGACY_LINE_TO_PROTEIN: Record<LegacyLine, ProteinKey> = {
  basic: 'duck',
  weight: 'chicken',
  skin: 'salmon',
  premium: 'beef',
  joint: 'pork',
}

/** slug → 단백질. */
export const SLUG_TO_PROTEIN: Record<string, ProteinKey> = Object.fromEntries(
  ALL_PROTEINS.map((p) => [SKU_MODEL[p].slug, p]),
)

/** 단백질 SkuDef 조회. */
export function getSku(protein: ProteinKey): SkuDef {
  return SKU_MODEL[protein]
}

/** preferred_proteins(설문 문자열) → ProteinKey. lamb 등 미보유는 null. */
export function proteinKeyOf(raw: string): ProteinKey | null {
  return (ALL_PROTEINS as string[]).includes(raw) ? (raw as ProteinKey) : null
}
