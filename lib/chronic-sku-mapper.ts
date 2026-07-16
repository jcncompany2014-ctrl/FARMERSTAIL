/**
 * Farmer's Tail — 만성질환 → SKU 자동 매핑 (Tier S F2-3, 2026-05-20)
 *
 * 사용자 설문 (surveys.chronic_conditions) 응답 → 적합 SKU 우선순위.
 * lib/allergy-sku-matrix.ts 의 결과와 교집합 사용 (알레르기 회피 + 만성질환 적합).
 *
 * # 매핑 원칙
 *   관절염 (arthritis)        → S03 우선 (EPA/DHA 자연 1.2g/100g)
 *   비만 (obesity)            → D02·P04 우선 (지방 ↓)
 *   피부 알레르기 (skin)       → D02·P04 우선 (novel protein)
 *   소화 민감 (gi_sensitive)   → C01·D02 우선 (저알러지 + 가벼움)
 *   신장 (renal, manage)      → 별도 처방식 영역 — 본 라인업 외 (v4.x)
 *   당뇨 (diabetes)           → D02·P04 (저지방·저당)
 *   심장 (cardiac/DCM)        → S03 + 타우린 보강 (FDA 2018 grain-free DCM)
 *
 * # 노령견 (senior) 별도 처리
 *   age >= 7 (소·중형) 또는 5 (대형) → S03 + EPA/DHA 강조
 *
 * # 자견 (puppy) 별도 처리
 *   age < 12개월 → 자견용 Ca:P 1.0~1.6:1 엄격 (FEDIAF Growth 표)
 *   본 라인업 성견 표 기반이라 자견은 분량 ↑ + 수의사 상담 권고
 */

import type { SkuKey } from './allergy-sku-matrix'
import { ALERT_COPY, RECOMMENDATION_COPY, withDogName } from './copy-strings'

/**
 * 만성질환 키 (surveys.chronic_conditions 값과 일치).
 *
 * R86-C3: lib/nutrition/guidelines.ts 의 `ChronicConditionKey` (22개) 와 키 이름이
 *   달라 사용자가 설문에서 "allergy_skin" 선택해도 mapper 가 default 만 반환했음.
 *   이제 양쪽 네이밍 모두 인식 (alias) + 추가 chronic 13종 vetConsult 처리.
 */
export type ChronicCondition =
  // legacy mapper 키
  | 'arthritis'
  | 'obesity'
  | 'skin_allergy'
  | 'gi_sensitive'
  | 'renal'
  | 'diabetes'
  | 'cardiac'
  | 'dental'
  | 'liver'
  // guidelines.ts 네이밍 alias (DB surveys.chronic_conditions 가 이쪽 사용)
  | 'allergy_skin'
  | 'kidney'
  | 'mmvd'
  | 'ibd'
  // guidelines.ts 추가 만성질환 (mapper 가 SKU 가중치 없으면 vetConsult only)
  | 'long_term_steroid'
  | 'epilepsy'
  | 'epi'
  | 'patellar_luxation'
  | 'tracheal_collapse'
  | 'hypothyroid'
  | 'cushings'
  | 'ivdd'
  | 'pancreatitis'
  | 'urinary_stone'
  | 'cognitive_decline'

/**
 * DCM 호발 견종 (FDA 2018 grain-free DCM 보고서 + Mooney 2024 후속 연구).
 * Round D3 (2026-05-20): DCM screening reminder cron 에서도 import.
 */
export const DCM_RISK_BREEDS = [
  'doberman',
  'boxer',
  'cocker_spaniel',
  'great_dane',
  'irish_wolfhound',
  'golden_retriever',
  'newfoundland',
] as const

export interface ChronicSkuPriority {
  /** 만성질환 기반 우선 SKU (가중치 순) */
  priority_skus: SkuKey[]
  /** 사용자 노출 카피 (만성질환별) */
  recommendation_messages: string[]
  /** 안전 가드레일 경고 (DCM·자견·약물 등) */
  guardrail_alerts: string[]
  /** 수의사 상담 권장 여부 (자견·노령·신장 등) */
  vet_consult_recommended: boolean
}

export interface ChronicSkuInput {
  dogName: string
  chronicConditions: ChronicCondition[]
  ageMonths: number
  weightKg: number
  breed?: string | null
  medications?: string[] // 약물 (anticoagulant 등)
}

