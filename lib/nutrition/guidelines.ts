/**
 * 수의영양학 가이드라인 — 출처 + 질환별 식이 분기 테이블.
 *
 * 인용 출처
 * ────────
 * - NRC 2006: National Research Council, "Nutrient Requirements of Dogs and Cats"
 *   (https://nap.nationalacademies.org/catalog/10668)
 * - AAFCO 2024: Association of American Feed Control Officials, Dog Food Nutrient Profiles
 *   (Adult Maintenance / Growth & Reproduction)
 * - FEDIAF 2021: European Pet Food Industry Federation, "Nutritional Guidelines For
 *   Complete and Complementary Pet Food"
 * - WSAVA 2011: Body / Muscle Condition Score 가이드라인
 *   (https://wsava.org/global-guidelines/global-nutrition-guidelines/)
 * - ACVIM Consensus Statements (Chronic Kidney Disease 2013, Hepatic Lipidosis 등)
 *
 * 본 모듈은 위 가이드라인의 권장 수치를 코드로 옮긴 것 — 의료 자문이 아니라
 * "현재 가이드라인이 이 케이스에 무엇을 권장하는가" 를 산출하는 도구. 진료/처방을
 * 대체하지 않으며, 만성질환자는 항상 수의사 상담을 우선해야 함.
 */

export const GUIDELINE_VERSION = 'NRC2006+AAFCO2024+FEDIAF2021+WSAVA2011'

/** 가이드라인 출처 표시 — UI footer / 메일 footnote 등에 인용. */
export const GUIDELINE_CITATIONS = [
  {
    key: 'nrc2006',
    label: 'NRC 2006',
    title: 'Nutrient Requirements of Dogs and Cats',
    org: 'National Research Council (US)',
    url: 'https://nap.nationalacademies.org/catalog/10668',
  },
  {
    key: 'aafco2024',
    label: 'AAFCO 2024',
    title: 'Dog Food Nutrient Profiles',
    org: 'Association of American Feed Control Officials',
    url: 'https://www.aafco.org/',
  },
  {
    key: 'fediaf2021',
    label: 'FEDIAF 2021',
    title: 'Nutritional Guidelines for Complete and Complementary Pet Food',
    org: 'European Pet Food Industry Federation',
    url: 'https://europeanpetfood.org/self-regulation/nutritional-guidelines/',
  },
  {
    key: 'wsava',
    label: 'WSAVA',
    title: 'Body / Muscle Condition Score Guidelines',
    org: 'World Small Animal Veterinary Association',
    url: 'https://wsava.org/global-guidelines/global-nutrition-guidelines/',
  },
  {
    key: 'acvim_kidney',
    label: 'ACVIM CKD',
    title: 'Consensus Statement on Chronic Kidney Disease',
    org: 'American College of Veterinary Internal Medicine',
    url: 'https://onlinelibrary.wiley.com/journal/19391676',
  },
] as const

// ────────────────────────────────────────────────────────────────────────────
// Body Condition Score (WSAVA 9-point)
// ────────────────────────────────────────────────────────────────────────────

export type BcsKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const BCS_DESCRIPTIONS: Record<
  BcsKey,
  { label: string; desc: string; risk: 'severe_under' | 'under' | 'ideal' | 'over' | 'severe_over' }
> = {
  1: { label: 'BCS 1', desc: '심한 저체중 — 갈비뼈/등뼈/골반뼈가 멀리서도 보임, 근육량 손실', risk: 'severe_under' },
  2: { label: 'BCS 2', desc: '저체중 — 갈비뼈가 쉽게 보이고 만져짐, 허리가 매우 잘록', risk: 'severe_under' },
  3: { label: 'BCS 3', desc: '약간 저체중 — 갈비뼈 만져지고 윤곽 보임, 허리 잘록', risk: 'under' },
  4: { label: 'BCS 4', desc: '약간 마름 — 갈비뼈 쉽게 만져짐, 옆에서 배 라인 살짝 들어감', risk: 'under' },
  5: { label: 'BCS 5', desc: '이상적 — 갈비뼈 만져지지만 안 보임, 허리·복부 라인 깔끔', risk: 'ideal' },
  6: { label: 'BCS 6', desc: '약간 과체중 — 갈비뼈 약간 어렵게 만져짐, 허리 라인 흐려짐', risk: 'over' },
  7: { label: 'BCS 7', desc: '과체중 — 갈비뼈 만지기 어려움, 허리 라인 거의 사라짐', risk: 'over' },
  8: { label: 'BCS 8', desc: '비만 — 갈비뼈 만지기 매우 어려움, 복부 처짐, 허리 사라짐', risk: 'severe_over' },
  9: { label: 'BCS 9', desc: '심한 비만 — 흉곽/등/허리에 두꺼운 지방층, 복부 크게 처짐', risk: 'severe_over' },
}

/** BCS → MER 보정 factor. 비만은 감량을 위해 RER 의 1.0 ~ 1.4 만 사용. */
export function bcsMerFactor(bcs: BcsKey): number {
  switch (bcs) {
    case 1:
    case 2:
      return 1.4 // 증량 — RER × 1.4 ~ 1.6
    case 3:
    case 4:
      return 1.1
    case 5:
      return 1.0
    case 6:
      return 0.95
    case 7:
      return 0.85
    case 8:
      return 0.8
    case 9:
      return 0.75
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Muscle Condition Score (WSAVA 4-grade)
// ────────────────────────────────────────────────────────────────────────────

export type McsKey = 1 | 2 | 3 | 4

export const MCS_DESCRIPTIONS: Record<McsKey, { label: string; desc: string }> = {
  1: { label: 'MCS 정상', desc: '근육 손실 없음 — 척추뼈/관골뼈/견갑골 위에 정상 근육' },
  2: { label: 'MCS 경도 손실', desc: '약간의 근육 감소 — 뼈 위 근육이 약간 평평' },
  3: { label: 'MCS 중등도 손실', desc: '뚜렷한 근육 감소 — 뼈 윤곽이 분명히 드러남' },
  4: { label: 'MCS 중증 손실', desc: '심한 근육 감소 — 뼈만 만져지고 근육 거의 없음' },
}

// ────────────────────────────────────────────────────────────────────────────
// 만성질환 코드 — 식이 분기 + AI 프롬프트에 노출
// ────────────────────────────────────────────────────────────────────────────

export type ChronicConditionKey =
  | 'diabetes'         // 당뇨
  | 'kidney'           // 만성신장질환 (CKD)
  | 'cardiac'          // 심장질환
  | 'pancreatitis'     // 췌장염
  | 'ibd'              // 염증성 장질환
  | 'allergy_skin'     // 알레르기성 피부염
  | 'arthritis'        // 관절염
  | 'liver'            // 간질환
  | 'dental'           // 치주질환
  | 'epilepsy'         // 간질
  | 'urinary_stone'    // 요결석

export const CHRONIC_CONDITION_LABELS: Record<ChronicConditionKey, string> = {
  diabetes: '당뇨',
  kidney: '만성 신장질환',
  cardiac: '심장질환',
  pancreatitis: '췌장염',
  ibd: '염증성 장질환 (IBD)',
  allergy_skin: '알레르기성 피부염',
  arthritis: '관절염',
  liver: '간질환',
  dental: '치주질환',
  epilepsy: '간질',
  urinary_stone: '요결석',
}

/**
 * 질환별 식이 권장 — 전문 가이드라인을 코드로 옮김.
 * 충돌하는 권장이 동시에 트리거되면 AI 가 케이스 노트에서 우선순위를 명시.
 */
export type DietAdjustment = {
  /** 단백질 비율 변화 (조정 percentage point) */
  proteinDelta: number
  /** 지방 비율 변화 */
  fatDelta: number
  /** 탄수화물 변화 */
  carbDelta: number
  /** 식이섬유 변화 */
  fiberDelta: number
  /** 권장 보충제 키 */
  supplements: string[]
  /** 위험 플래그 — UI / AI 에 노출 */
  riskFlags: string[]
  /** 출처 인용 키 (GUIDELINE_CITATIONS.key) */
  cite: string[]
  /** 수의사 상담 강력 권장 여부 */
  vetConsult: boolean
  /** 미네랄 / 미량영양소 보정 */
  micro?: {
    phosphorusFactor?: number   // 신장 질환 → 0.6
    sodiumFactor?: number       // 심장 → 0.6
    omega3Factor?: number       // 관절/피부 → 1.5
    omega6Factor?: number
    zincFactor?: number
    calciumFactor?: number
  }
}

export const CONDITION_ADJUSTMENTS: Record<ChronicConditionKey, DietAdjustment> = {
  diabetes: {
    proteinDelta: 5,
    fatDelta: -3,
    carbDelta: -8,        // 저탄수, 단순당 회피
    fiberDelta: 6,        // 고섬유 — 혈당 안정
    supplements: ['크롬', 'L-카르니틴'],
    riskFlags: ['DIABETIC_DIET_REQUIRED'],
    cite: ['acvim_kidney', 'fediaf2021'],
    vetConsult: true,
  },
  kidney: {
    proteinDelta: -6,     // 적정 단백 (일부 가이드라인은 고품질만 유지 권장 — AI 가 미세조정)
    fatDelta: 0,
    carbDelta: 4,
    fiberDelta: 2,
    supplements: ['오메가-3 (EPA)', '비타민 B군', '수분 보충'],
    riskFlags: ['CKD_DIET_REQUIRED'],
    cite: ['acvim_kidney', 'nrc2006'],
    vetConsult: true,
    micro: {
      phosphorusFactor: 0.6,  // 인 제한 — CKD 핵심
      sodiumFactor: 0.7,
      omega3Factor: 1.6,
    },
  },
  cardiac: {
    proteinDelta: 0,
    fatDelta: -2,
    carbDelta: 2,
    fiberDelta: 0,
    supplements: ['타우린', 'L-카르니틴', '오메가-3'],
    riskFlags: ['CARDIAC_LOW_SODIUM'],
    cite: ['nrc2006'],
    vetConsult: true,
    micro: {
      sodiumFactor: 0.5,
      omega3Factor: 1.5,
    },
  },
  pancreatitis: {
    proteinDelta: 2,
    fatDelta: -8,         // 저지방 — 췌장 부담 최소화
    carbDelta: 4,
    fiberDelta: 2,
    supplements: ['프로바이오틱스'],
    riskFlags: ['LOW_FAT_REQUIRED'],
    cite: ['fediaf2021'],
    vetConsult: true,
  },
  ibd: {
    proteinDelta: 2,      // 단일 단백질 우선
    fatDelta: -2,
    carbDelta: 0,
    fiberDelta: 4,        // 가용성 식이섬유
    supplements: ['프로바이오틱스', 'L-글루타민'],
    riskFlags: ['SINGLE_PROTEIN_REQUIRED'],
    cite: ['fediaf2021'],
    vetConsult: true,
  },
  allergy_skin: {
    proteinDelta: 0,
    fatDelta: 2,
    carbDelta: -2,
    fiberDelta: 0,
    supplements: ['오메가-3', '아연', '비오틴'],
    riskFlags: ['HYPOALLERGENIC_DIET'],
    cite: ['fediaf2021'],
    vetConsult: false,
    micro: {
      omega3Factor: 1.5,
      omega6Factor: 1.2,
      zincFactor: 1.3,
    },
  },
  arthritis: {
    proteinDelta: 2,
    fatDelta: 0,
    carbDelta: -2,
    fiberDelta: 0,
    supplements: ['글루코사민+콘드로이틴', '오메가-3 (EPA)', '초록입홍합'],
    riskFlags: ['JOINT_SUPPORT'],
    cite: ['nrc2006'],
    vetConsult: false,
    micro: {
      omega3Factor: 1.5,
    },
  },
  liver: {
    proteinDelta: -3,     // 단백질 적정 — 너무 줄이면 근손실
    fatDelta: -2,
    carbDelta: 5,
    fiberDelta: 0,
    supplements: ['SAMe', '실리마린 (밀크씨슬)', '비타민 K'],
    riskFlags: ['HEPATIC_SUPPORT'],
    cite: ['nrc2006'],
    vetConsult: true,
  },
  dental: {
    proteinDelta: 0,
    fatDelta: 0,
    carbDelta: 0,
    fiberDelta: 1,        // 거친 텍스처
    supplements: ['치석 분해 효소'],
    riskFlags: [],
    cite: [],
    vetConsult: false,
  },
  epilepsy: {
    proteinDelta: -2,
    fatDelta: 8,          // MCT (중쇄지방산) — ketogenic 식단
    carbDelta: -6,
    fiberDelta: 0,
    supplements: ['MCT 오일', '오메가-3'],
    riskFlags: ['KETOGENIC_DIET'],
    cite: ['nrc2006'],
    vetConsult: true,
  },
  urinary_stone: {
    proteinDelta: -3,
    fatDelta: 0,
    carbDelta: 3,
    fiberDelta: 0,
    supplements: ['수분 보충', '크랜베리 추출물'],
    riskFlags: ['LOW_OXALATE_DIET'],
    cite: ['fediaf2021'],
    vetConsult: true,
    micro: {
      calciumFactor: 0.9,
    },
  },
}

// ────────────────────────────────────────────────────────────────────────────
// Bristol Stool — 영양 신호
// ────────────────────────────────────────────────────────────────────────────

export const BRISTOL_INTERPRETATION: Record<
  number,
  { label: string; signal: string; nutritionAction: string | null }
> = {
  1: { label: '딱딱한 알 (변비)', signal: '심한 변비', nutritionAction: '식이섬유 +3pt, 수분 강화' },
  2: { label: '울퉁불퉁 굳은 변', signal: '경증 변비', nutritionAction: '식이섬유 +1pt' },
  3: { label: '겉이 갈라진 형태', signal: '경계 — 정상 가까움', nutritionAction: null },
  4: { label: '매끄러운 소시지형 (이상적)', signal: '정상', nutritionAction: null },
  5: { label: '부드러운 덩어리', signal: '경계 — 무른 변', nutritionAction: '식이섬유 +1pt, 가용성 섬유' },
  6: { label: '죽 같은 무른 변', signal: '경증 설사', nutritionAction: '프로바이오틱스, 가용성 섬유 보강' },
  7: { label: '액체에 가까운 변', signal: '심한 설사', nutritionAction: '단기 BRAT 식단, 수의사 상담' },
}
