/**
 * Farmer's Tail — 품종별 영양 priority 매핑 (Round E3, 2026-05-20).
 *
 * 35종+ 견종별로 가장 흔한 영양 이슈 + 우선 SKU + 핵심 영양소 노트.
 *
 * # 설계
 *   - registry.ts 의 견종 code 를 key 로 — 1:1 매핑.
 *   - priority_skus 는 lib/allergy-sku-matrix.ts 의 SkuKey 만 사용.
 *   - nutrition_focus 는 38영양소 중 강조 항목 (UI 게이지 색상 ↑ 가능).
 *   - 데이터 출처: AKC breed health profiles + Mooney 2024 DCM 후속 +
 *     자체 한국 견종 등록 통계 (시판 견종 다발 질환).
 *
 * # 사용처
 *   - 분석 페이지 — "○○이는 ○ 견종 특성상 ○ 신경 쓰면 좋아요" 카피
 *   - 추천 SKU 정렬 가중치
 *   - 미래 — 견종별 cohort 비교 (Admin Cohort 대시보드)
 */

import type { SkuKey } from './allergy-sku-matrix'

export interface BreedNutritionPriority {
  /** registry.ts BreedInfo.code */
  breedCode: string
  /** 우선 SKU (가중치 순) */
  priority_skus: SkuKey[]
  /** 38영양소 중 강조할 영양소 id (lib/nrc-38-nutrients.ts) */
  nutrition_focus: string[]
  /** 사용자 노출 한 줄 카피 */
  recommendation_ko: string
  /** 견종별 다발 건강 이슈 (참고용) */
  common_issues: string[]
}

export const BREED_NUTRITION_PRIORITY: BreedNutritionPriority[] = [
  // ── Toy ────────────────────────────────────────────────
  {
    breedCode: 'pomeranian',
    priority_skus: ['D02', 'C01'],
    nutrition_focus: ['protein', 'epa_dha', 'ca'],
    recommendation_ko: '소형견 — 단백 부족 시 근육 감소 빠름. 오리·닭 균형형.',
    common_issues: ['patellar_luxation', 'tracheal_collapse'],
  },
  {
    breedCode: 'maltese',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['epa_dha', 'vit_e'],
    recommendation_ko: '눈물 자국 ↓ — Novel protein + 항산화. 오리·돼지.',
    common_issues: ['tear_staining', 'liver_shunt'],
  },
  {
    breedCode: 'chihuahua',
    priority_skus: ['C01', 'D02'],
    nutrition_focus: ['protein', 'ca'],
    recommendation_ko: '치아·뼈 약함 — 칼슘·인 균형. 닭·오리.',
    common_issues: ['dental_disease', 'patellar_luxation'],
  },
  {
    breedCode: 'toy_poodle',
    priority_skus: ['D02', 'C01'],
    nutrition_focus: ['epa_dha', 'protein'],
    recommendation_ko: '활동량 多 — 근육 + 모질. 오리·닭.',
    common_issues: ['progressive_retinal_atrophy'],
  },
  {
    breedCode: 'yorkie',
    priority_skus: ['D02', 'C01'],
    nutrition_focus: ['protein', 'epa_dha', 'vit_e'],
    recommendation_ko: '모질 + 눈물 자국 — Novel protein.',
    common_issues: ['portosystemic_shunt', 'tracheal_collapse'],
  },
  {
    breedCode: 'papillon',
    priority_skus: ['C01', 'D02'],
    nutrition_focus: ['protein'],
    recommendation_ko: '활발한 토이 — 균형형 단백.',
    common_issues: ['patellar_luxation'],
  },
  {
    breedCode: 'shih_tzu',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['epa_dha', 'vit_a'],
    recommendation_ko: '눈·피부 관리 — Omega-3 + 비타민 A.',
    common_issues: ['eye_problems', 'brachycephalic_syndrome'],
  },

  // ── Small ──────────────────────────────────────────────
  {
    breedCode: 'bichon',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['vit_e', 'epa_dha'],
    recommendation_ko: '아토피 다발 — Novel protein + 항산화.',
    common_issues: ['skin_allergies'],
  },
  {
    breedCode: 'mini_poodle',
    priority_skus: ['D02', 'S03'],
    nutrition_focus: ['epa_dha', 'protein'],
    recommendation_ko: '활동량 多 — 단백 + 오메가-3.',
    common_issues: ['hip_dysplasia', 'addison_disease'],
  },
  {
    breedCode: 'dachshund',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'ca', 'epa_dha'],
    recommendation_ko: '비만 → IVDD 위험 — 저지방 + 체중관리 우선.',
    common_issues: ['ivdd', 'obesity'],
  },
  {
    breedCode: 'pug',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'epa_dha'],
    recommendation_ko: '비만 + 호흡기 — 저지방 우선.',
    common_issues: ['brachycephalic_syndrome', 'obesity'],
  },
  {
    breedCode: 'jack_russell',
    priority_skus: ['C01', 'B05'],
    nutrition_focus: ['protein', 'fat'],
    recommendation_ko: '에너지 多 — 고단백·고지방.',
    common_issues: ['patellar_luxation'],
  },
  {
    breedCode: 'schnauzer_mini',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'epa_dha'],
    recommendation_ko: '췌장염 risk — 저지방 + 단백 다양화.',
    common_issues: ['pancreatitis', 'urinary_stones'],
  },
  {
    breedCode: 'cocker',
    priority_skus: ['S03', 'D02'],
    nutrition_focus: ['epa_dha', 'vit_a', 'protein'],
    recommendation_ko: 'DCM 호발 + 귀 염증 — 타우린·오메가-3.',
    common_issues: ['dcm', 'ear_infections'],
  },

  // ── Medium ─────────────────────────────────────────────
  {
    breedCode: 'beagle',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'protein'],
    recommendation_ko: '비만 다발 — 저지방 + 식이섬유.',
    common_issues: ['obesity', 'epilepsy'],
  },
  {
    breedCode: 'corgi',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'epa_dha'],
    recommendation_ko: '비만 + 척추 — 체중관리 + 관절.',
    common_issues: ['obesity', 'ivdd'],
  },
  {
    breedCode: 'shiba',
    priority_skus: ['C01', 'D02'],
    nutrition_focus: ['protein', 'vit_e'],
    recommendation_ko: '알레르기 multi — Novel rotation 권장.',
    common_issues: ['allergies', 'hip_dysplasia'],
  },
  {
    breedCode: 'french_bulldog',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'epa_dha'],
    recommendation_ko: '비만 + 호흡기 — 저지방 우선.',
    common_issues: ['brachycephalic_syndrome', 'skin_fold_dermatitis'],
  },
  {
    breedCode: 'jindo',
    priority_skus: ['C01', 'B05'],
    nutrition_focus: ['protein', 'epa_dha'],
    recommendation_ko: '활동성 多 — 고단백 한우.',
    common_issues: [],
  },
  {
    breedCode: 'pungsan',
    priority_skus: ['B05', 'C01'],
    nutrition_focus: ['protein', 'ca'],
    recommendation_ko: '대형 사역견 — 한우 + 뼈·관절.',
    common_issues: ['hip_dysplasia'],
  },
  {
    breedCode: 'sapsali',
    priority_skus: ['C01', 'D02'],
    nutrition_focus: ['protein', 'vit_e'],
    recommendation_ko: '한국 토종 — 균형형.',
    common_issues: [],
  },
  {
    breedCode: 'border_collie',
    priority_skus: ['B05', 'S03'],
    nutrition_focus: ['protein', 'epa_dha', 'fat'],
    recommendation_ko: '활동량 최대 — 고에너지 + 관절.',
    common_issues: ['hip_dysplasia', 'epilepsy'],
  },
  {
    breedCode: 'samoyed',
    priority_skus: ['S03', 'B05'],
    nutrition_focus: ['epa_dha', 'protein'],
    recommendation_ko: '모질 + 관절 — 연어 + 한우 rotation.',
    common_issues: ['hip_dysplasia', 'samoyed_hereditary_nephritis'],
  },
  {
    breedCode: 'husky',
    priority_skus: ['B05', 'S03'],
    nutrition_focus: ['protein', 'fat', 'epa_dha'],
    recommendation_ko: '극지 견 — 고지방 + 고단백.',
    common_issues: ['hip_dysplasia', 'eye_problems'],
  },
  {
    breedCode: 'australian_shepherd',
    priority_skus: ['B05', 'S03'],
    nutrition_focus: ['protein', 'epa_dha'],
    recommendation_ko: '활동량 매우 多 — 고단백 + 오메가-3.',
    common_issues: ['hip_dysplasia', 'mdr1_drug_sensitivity'],
  },

  // ── Large ──────────────────────────────────────────────
  {
    breedCode: 'golden_retriever',
    priority_skus: ['S03', 'D02'],
    nutrition_focus: ['epa_dha', 'fat', 'ca'],
    recommendation_ko: '관절 + 림프종 — 연어 EPA/DHA 우선.',
    common_issues: ['hip_dysplasia', 'cancer_lymphoma'],
  },
  {
    breedCode: 'labrador',
    priority_skus: ['D02', 'S03'],
    nutrition_focus: ['fat', 'epa_dha', 'ca'],
    recommendation_ko: '비만 + 관절 — 저지방 + EPA/DHA.',
    common_issues: ['obesity', 'hip_dysplasia'],
  },
  {
    breedCode: 'german_shepherd',
    priority_skus: ['B05', 'S03'],
    nutrition_focus: ['protein', 'epa_dha', 'ca'],
    recommendation_ko: '관절 + 위확장 — 단백 + EPA/DHA.',
    common_issues: ['hip_dysplasia', 'gastric_torsion'],
  },
  {
    breedCode: 'dalmatian',
    priority_skus: ['P04', 'C01'],
    nutrition_focus: ['protein'],
    recommendation_ko: '요로결석 — 저퓨린 단백 (돼지 우선).',
    common_issues: ['urate_stones', 'deafness'],
  },
  {
    breedCode: 'bulldog',
    priority_skus: ['D02', 'P04'],
    nutrition_focus: ['fat', 'epa_dha'],
    recommendation_ko: '호흡기 + 비만 — 저지방.',
    common_issues: ['brachycephalic_syndrome', 'skin_fold_dermatitis'],
  },
  {
    breedCode: 'rottweiler',
    priority_skus: ['B05', 'S03'],
    nutrition_focus: ['protein', 'ca', 'epa_dha'],
    recommendation_ko: '대형 근육견 — 고단백 + 관절.',
    common_issues: ['hip_dysplasia', 'cardiac', 'osteosarcoma'],
  },
  {
    breedCode: 'doberman',
    priority_skus: ['S03', 'B05'],
    nutrition_focus: ['epa_dha', 'protein'],
    recommendation_ko: 'DCM 호발 — 타우린·연어 EPA/DHA.',
    common_issues: ['dcm', 'von_willebrand'],
  },
  {
    breedCode: 'boxer',
    priority_skus: ['S03', 'D02'],
    nutrition_focus: ['epa_dha', 'protein'],
    recommendation_ko: 'DCM + 암 — 연어 EPA/DHA + 항산화.',
    common_issues: ['dcm', 'cancer_lymphoma'],
  },

  // ── Giant ──────────────────────────────────────────────
  {
    breedCode: 'great_dane',
    priority_skus: ['S03', 'B05'],
    nutrition_focus: ['ca', 'epa_dha', 'protein'],
    recommendation_ko: '거대견 — 칼슘·관절 + EPA/DHA.',
    common_issues: ['gastric_torsion', 'hip_dysplasia', 'dcm'],
  },
  {
    breedCode: 'newfoundland',
    priority_skus: ['S03', 'B05'],
    nutrition_focus: ['epa_dha', 'ca', 'fat'],
    recommendation_ko: '거대견 + 심장 — 연어 + 한우 rotation.',
    common_issues: ['dcm', 'hip_dysplasia', 'cystinuria'],
  },

  // ── Mix / 기타 ─────────────────────────────────────────
  {
    breedCode: 'mix',
    priority_skus: ['C01', 'D02'],
    nutrition_focus: ['protein', 'epa_dha'],
    recommendation_ko: '믹스견 — 균형형 + 다양성 rotation.',
    common_issues: [],
  },
] as const

/**
 * breedCode 로 priority lookup. 없으면 null.
 */
export function findBreedPriority(
  breedCode: string,
): BreedNutritionPriority | null {
  return (
    BREED_NUTRITION_PRIORITY.find((b) => b.breedCode === breedCode) ?? null
  )
}

/**
 * 견종 → 우선 SKU 1개. 추천 정렬 가중치로 활용 가능.
 */
export function preferredSkuForBreed(breedCode: string): SkuKey | null {
  return findBreedPriority(breedCode)?.priority_skus[0] ?? null
}
