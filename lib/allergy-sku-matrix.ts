/**
 * Farmer's Tail — 알레르기 진단 → SKU 자동 추천 + Bexley 교차반응 경고
 * (Tier S F2-2 + F5-2, 2026-05-20)
 *
 * # 학술 근거
 *
 * ## Mueller RS, Olivry T, Prélaud P. 2016. BMC Vet Res 12:9
 *   DOI: 10.1186/s12917-016-0633-8 (PMC4710035)
 *   297두 분석:
 *     beef 102두 / 34% (1위)
 *     dairy 51 / 17%
 *     chicken 45 / 15%
 *     wheat 38 / 13%
 *     lamb 14 / 5%
 *     soy 18 / 6%
 *     corn 13 / 4%
 *     egg 11 / 4%
 *     pork 7 / 2%
 *     fish 5 / 2%
 *     rice 5 / 2% (최저)
 *
 * ## Bexley J, Kingswell N, Olivry T. 2019. Vet Dermatol 30(1):25-e8
 *   DOI: 10.1111/vde.12691 (PMID 30378189)
 *   닭-어류 교차반응성 IgE-binding 단백질 9종 식별
 *   (β-enolase, aldolase A, parvalbumin 등) → 닭 양성견 어류 도입 시 주의
 *
 * # SKU 매핑 원칙
 * 알레르기 진단된 단백질은 회피, novel protein 우선 추천.
 *
 *   닭 알레르기 → 오리(D02) 1순위 > 돼지(P04) > 한우(B05) > 연어(S03 — Bexley 주의)
 *   소 알레르기 → 닭·오리·돼지·연어 모두 가능 (가장 흔한 1순위 알레르겐)
 *   어류 알레르기 → 닭·오리·돼지·한우 (FT-S03 회피)
 *   오리 알레르기 → 매우 드묾, 본 데이터셋 미보고
 *   돼지 알레르기 → Mueller 2016 2% (드묾)
 */

import { ALERT_COPY, withDogName } from './copy-strings.ts'

/** 5종 SKU 키 */
export type SkuKey = 'C01' | 'D02' | 'S03' | 'P04' | 'B05'

/** SKU 메타데이터 */
export const SKU_META: Record<SkuKey, {
  /** 내부 코드 — 고객 노출 금지(사장님 2026-07-14 "사람들이 못 알아들어"). */
  code: string
  /** 고객 표시명 — '치킨'·'오리'·'흑돼지'·'한우' (사장님 2026-07-15). */
  name_ko: string
  /** 알레르기 성분명 — 표시명과 별개('치킨' 제품의 성분은 '닭'). */
  protein_ko: string
  protein_en: string
  novel: boolean
  mueller_2016_allergy_rate: number // % (소수점 1자리)
}> = {
  C01: { code: 'FT-C01', name_ko: '치킨', protein_ko: '닭', protein_en: 'chicken', novel: false, mueller_2016_allergy_rate: 15.0 },
  D02: { code: 'FT-D02', name_ko: '오리', protein_ko: '오리', protein_en: 'duck', novel: true, mueller_2016_allergy_rate: 0.5 },
  S03: { code: 'FT-S03', name_ko: '연어', protein_ko: '연어', protein_en: 'fish', novel: true, mueller_2016_allergy_rate: 2.0 },
  P04: { code: 'FT-P04', name_ko: '흑돼지', protein_ko: '돼지', protein_en: 'pork', novel: true, mueller_2016_allergy_rate: 2.0 },
  B05: { code: 'FT-B05', name_ko: '한우', protein_ko: '소', protein_en: 'beef', novel: false, mueller_2016_allergy_rate: 34.0 },
}

/** 알레르기 단백질 enum (Mueller 2016 + 한국 시장 추가) */
export type AllergenProtein =
  | 'chicken'
  | 'beef'
  | 'fish'
  | 'duck'
  | 'pork'
  | 'lamb'
  | 'dairy'
  | 'wheat'
  | 'egg'
  | 'soy'
  | 'corn'
  | 'rice'

export interface SkuRecommendation {
  /** 안전 SKU (사용자 알레르기 회피) — 우선순위 순 */
  recommended_skus: SkuKey[]
  /** 회피 SKU + 사유 */
  avoided_skus: Array<{ sku: SkuKey; reason: string }>
  /** Bexley 2019 교차반응 경고 표시 여부 (닭 양성 + S03 추천 시) */
  bexley_warning: boolean
  /** 사용자 노출 경고 메시지 (Bexley 등) */
  alert_message: string | null
}

/**
 * 알레르기 진단 단백질 리스트 → 5종 SKU 추천 + 회피.
 *
 * @example
 *   recommendSkuForAllergies(['chicken'], '봉봉')
 *   // → recommended_skus: ['D02', 'P04', 'B05', 'S03']
 *   //   bexley_warning: true (S03 포함되므로 닭-어류 교차 경고)
 */
export function recommendSkuForAllergies(
  allergies: AllergenProtein[],
  dogName: string,
): SkuRecommendation {
  const safe: SkuKey[] = []
  const avoided: Array<{ sku: SkuKey; reason: string }> = []

  // SKU 우선순위 (novel protein 우선, 알레르기율 낮은 순)
  const skuPriority: SkuKey[] = ['D02', 'P04', 'S03', 'C01', 'B05']

  for (const sku of skuPriority) {
    const meta = SKU_META[sku]
    const conflict = allergies.find((a) => a === meta.protein_en)

    if (conflict) {
      avoided.push({
        sku,
        reason: `${meta.protein_ko} 알레르기 진단으로 회피 (Mueller 2016: ${meta.mueller_2016_allergy_rate}%)`,
      })
    } else {
      safe.push(sku)
    }
  }

  // Bexley 2019 교차반응 — 닭 양성 + 추천에 S03 포함 시 경고
  const hasChickenAllergy = allergies.includes('chicken')
  const recommendsFish = safe.includes('S03')
  const bexleyWarning = hasChickenAllergy && recommendsFish

  let alertMessage: string | null = null
  if (bexleyWarning) {
    alertMessage = withDogName(
      ALERT_COPY.bexley_chicken_fish_crossreact('○○'),
      dogName,
    )
  }

  return {
    recommended_skus: safe,
    avoided_skus: avoided,
    bexley_warning: bexleyWarning,
    alert_message: alertMessage,
  }
}

/**
 * 가장 안전한 1개 SKU 자동 선택 (default 추천용).
 * 추천 리스트의 첫 번째 (가장 novel + 알레르기율 낮은 것).
 */
export function pickPrimaryRecommendation(
  rec: SkuRecommendation,
): SkuKey | null {
  return rec.recommended_skus[0] ?? null
}
