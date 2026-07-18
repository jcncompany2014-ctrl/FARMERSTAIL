/**
 * SKU 모델 — 추천 알고리즘 v2.0 단일 진실 소스 (SSOT).
 *
 * 라인 정체성을 **단백질 키**(chicken/duck/pork/beef/salmon)로 재정의.
 * 컨셉(체중관리 등)은 메타데이터. 에너지·영양 프로파일·페르소나·알레르기·
 * slug·케어목표를 한 곳에 통합 → lines.ts(FOOD_LINE_META) + allergy-sku-matrix
 * (SKU_META) + skuMap(LINE_TO_SLUG) 의 중복을 흡수한다.
 *
 * # 근거 (최종 마스터 레시피 v2.1, 2026-06)
 *  - kcal/100g: **닭115 · 오리120 · 흑돼지115 · 한우120** (2026-07-11 검정 확정).
 *    ⚠️ 이 헤더는 2026-07-16 까지 sheet7 as-fed **설계값**(닭130·오리150·돼지140·
 *    소160)을 적고 있었다 — 아래 데이터는 진작 확정값으로 바뀌었는데 주석만 옛날
 *    것이었다. 급여량으로 직결되는 숫자라 주석을 믿고 계산하면 어긋난다.
 *    숫자의 정본은 **언제나 아래 profile 의 kcalPer100g** 다.
 *    (연어 160 은 예외 — deferred:true, 출시 전 USDA 추정이라 검정 대상이 아니다.)
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
  /**
   * 고객 표시명 — '치킨'·'오리'·'흑돼지'·'한우' (사장님 2026-07-15).
   * ⚠️ 알레르기 성분명이 아니다. 성분은 여전히 '닭'·'돼지'(allergy-sku-matrix
   * 의 protein_ko / blockingAllergies) — 제품명과 성분명은 별개다.
   */
  nameKo: string
  /** 대표 페르소나. */
  persona: string
  /** 컨셉(메타). */
  concept: string
  /** UI 한 줄 표기 '프레시 치킨 레시피' (사장님 2026-07-15). 컨셉은 concept 에. */
  subtitle: string
  /** 한 줄 효능 — 고객이 읽는 문구(레시피 고르기 카드·박스 카드). 내부 용어 금지. */
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
    nameKo: '치킨',
    persona: '모찌',
    concept: '체중관리·항염',
    subtitle: '프레시 치킨 레시피',
    benefit: '4종 중 단백질이 가장 진해요. 근육 지키며 체중 관리에.',
    topping: '브로콜리',
    slug: 'chicken-basic',
    // v2.0 ③-A: 닭 = weight 키 (임상 '다이어트 라인' 룰이 닭을 가리키게).
    legacyLine: 'weight',
    novel: false,
    muellerAllergyRate: 15.0,
    blockingAllergies: ['닭·칠면조'],
    crossReactWith: [],
    careGoalAffinity: ['weight_management', 'general_upgrade'],
    profile: {
      // v4.0 확정 kcal(2026-07-18): 닭130·오리125·돼지125·소145. 4/9/4 계산치
      // 반올림(수비드 조리수율≈100%, 구 115/120은 폐기된 조리수율 가정). 칼로리↑
      // →급여량↓(과급여 방지). ★profile %DM은 아직 구 v3.1값. [[project_recipe_v31]]
      kcalPer100g: 130,
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
    subtitle: '프레시 오리 레시피',
    benefit: '닭·소를 뺐어요. 알레르기가 걱정될 때.',
    topping: '애호박',
    slug: 'duck-weight',
    // v2.0 ③-A: 오리 = basic 키 (노블/알레르기 라인).
    legacyLine: 'basic',
    novel: true,
    muellerAllergyRate: 0.5,
    blockingAllergies: ['오리'],
    crossReactWith: ['닭·칠면조'],
    careGoalAffinity: ['allergy_avoid'],
    profile: {
      kcalPer100g: 125, // v4.0 확정(2026-07-18)
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
    nameKo: '흑돼지',
    persona: '토토',
    concept: '기호·신경 B1',
    subtitle: '프레시 흑돼지 레시피',
    benefit: '부드럽고 소화가 편해요. 속 예민한 아이에게.',
    topping: '무',
    slug: 'pork-joint',
    legacyLine: 'joint',
    novel: true,
    muellerAllergyRate: 2.0,
    blockingAllergies: ['돼지고기'],
    crossReactWith: [],
    careGoalAffinity: ['joint_senior'],
    profile: {
      kcalPer100g: 125, // v4.0 확정(2026-07-18)
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
    nameKo: '한우',
    persona: '바람이',
    concept: '활력·프리미엄',
    subtitle: '프레시 한우 레시피',
    benefit: '철분이 풍부해요. 활동량 많은 아이에게.',
    topping: '비트',
    slug: 'beef-premium',
    legacyLine: 'premium',
    novel: false,
    muellerAllergyRate: 34.0,
    blockingAllergies: ['소고기', '양고기'],
    crossReactWith: ['양고기'],
    careGoalAffinity: ['general_upgrade'],
    profile: {
      kcalPer100g: 145, // v4.0 확정(2026-07-18)
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
    subtitle: '프레시 연어 레시피 (준비중)',
    benefit: '오메가3가 풍부해요. 피부·털에. (준비 중)',
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
 * "weight 라인 = 저칼로리·저지방 다이어트" 전제로 작성돼 있어, 닭(v4.0 130kcal·
 * 조단백 최고·조지방 낮은 편)을 weight 키에 바인딩하면 **룰 무변경**으로
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
