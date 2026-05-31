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

/**
 * R92 (D7): DCM 위험견 한국어 keyword 매칭.
 *
 * NewDog / EditDog 가 견종을 free text 로 입력받음 (dropdown / SSOT 매트릭스
 * 없음). 사용자가 "도베르만" 등 한국어로 입력하면 영문 키만 비교하는
 * isDcmRiskBreed 가 매칭 못 함 → DCM guardrail 누락 → 보호자 신뢰 손상.
 *
 * 보수적 substring 매칭 — 견종명에 keyword 포함 시 모두 위험견 처리.
 * (예: "골든리트리버 믹스" 도 매칭)
 *
 * BACKLOG: NewDog / EditDog 에 견종 dropdown + KO ↔ EN SSOT 매트릭스
 * 구축 후 이 함수 제거.
 */
const DCM_RISK_BREEDS_KO = [
  '도베르만',
  '복서',
  '코커스파니엘',
  '코카스파니엘',
  '그레이트데인',
  '아이리시울프하운드',
  '아이리쉬울프하운드',
  '골든리트리버',
  '골든리트리바',
  '뉴펀들랜드',
] as const

export function isDcmRiskBreed(breed?: string | null): boolean {
  if (!breed) return false
  const lower = breed.toLowerCase().replace(/[\s_-]/g, '')
  if (
    DCM_RISK_BREEDS.some((b) => lower.includes(b.replace(/_/g, '')))
  ) {
    return true
  }
  return DCM_RISK_BREEDS_KO.some((b) => breed.includes(b))
}

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

/**
 * 만성질환 + 견체 정보 → SKU 우선순위 + 가드레일 메시지.
 */
export function mapChronicToSku(input: ChronicSkuInput): ChronicSkuPriority {
  const { dogName, chronicConditions, ageMonths, weightKg, breed, medications } =
    input

  // SKU 가중치 (높을수록 우선) — 만성질환별 누적
  const score: Record<SkuKey, number> = {
    C01: 0,
    D02: 0,
    S03: 0,
    P04: 0,
    B05: 0,
  }

  const messages: string[] = []
  const guardrails: string[] = []
  let vetConsult = false

  // ── 만성질환별 가중치 누적 ──
  // R86-C3: legacy 키 + guidelines.ts alias 키 모두 인식.
  for (const cond of chronicConditions) {
    switch (cond) {
      case 'arthritis':
      case 'cardiac':
      case 'mmvd': // alias: guidelines.ts (Myxomatous Mitral Valve Disease)
        score.S03 += 3
        messages.push(
          withDogName(RECOMMENDATION_COPY.chronic.arthritis('○○'), dogName),
        )
        break
      case 'obesity':
      case 'diabetes':
        score.D02 += 3
        score.P04 += 2
        messages.push(
          withDogName(RECOMMENDATION_COPY.chronic.obesity('○○'), dogName),
        )
        break
      case 'skin_allergy':
      case 'allergy_skin': // alias: guidelines.ts
        score.D02 += 3
        score.P04 += 2
        messages.push(
          withDogName(RECOMMENDATION_COPY.chronic.skin_allergy('○○'), dogName),
        )
        break
      case 'gi_sensitive':
      case 'ibd': // alias: guidelines.ts (Inflammatory Bowel Disease)
      case 'pancreatitis':
        score.C01 += 2
        score.D02 += 2
        break
      case 'renal':
      case 'kidney': // alias: guidelines.ts
        // 신장 처방식은 본 라인업 영역 외 — 수의사 상담 강하게
        vetConsult = true
        break
      case 'dental':
        // 부드러운 화식 자체가 dental 친화 — 5종 모두 OK
        break
      case 'liver':
        score.C01 += 2
        score.D02 += 2 // 가벼운 단백 우선
        break
      // R86-C3: 추가 만성질환 — SKU 가중치 영향 없지만 수의사 상담 권장.
      // 추후 데이터 누적 후 가중치 룰 추가.
      case 'long_term_steroid':
      case 'epilepsy':
      case 'epi':
      case 'patellar_luxation':
      case 'tracheal_collapse':
      case 'hypothyroid':
      case 'cushings':
      case 'ivdd':
      case 'urinary_stone':
      case 'cognitive_decline':
        vetConsult = true
        break
    }
  }

  // ── 노령견 (senior) — 소·중형 7세+, 대형 5세+ ──
  const ageYears = ageMonths / 12
  const isSenior =
    (weightKg < 15 && ageYears >= 7) || (weightKg >= 15 && ageYears >= 5)
  if (isSenior) {
    score.S03 += 2
    messages.push(
      withDogName(RECOMMENDATION_COPY.chronic.senior('○○'), dogName),
    )
  }

  // ── 자견 (< 12개월) — Ca:P 엄격, 수의사 상담 권장 ──
  if (ageMonths < 12) {
    vetConsult = true
    guardrails.push(
      withDogName(ALERT_COPY.puppy_ca_p_strict('○○'), dogName),
    )
  }

  // ── DCM 위험견 ──
  // R92 (D7): 한국어 / 변종 표기 / substring 모두 인식 (isDcmRiskBreed).
  // 이전엔 영문 정확 매칭만 → "도베르만" 한글 입력 시 guardrail 누락.
  if (isDcmRiskBreed(breed)) {
    score.S03 += 2
    guardrails.push(
      withDogName(ALERT_COPY.dcm_risk_breed('○○'), dogName),
    )
  }

  // ── 약물 상호작용 (항응고제 + S03 EPA/DHA) ──
  const hasAnticoagulant =
    medications?.some((m) =>
      /와파린|warfarin|아스피린|aspirin|클로피도그렐|clopidogrel/i.test(m),
    ) ?? false
  if (hasAnticoagulant && score.S03 > 0) {
    guardrails.push(
      withDogName(ALERT_COPY.drug_interaction_anticoagulant('○○'), dogName),
    )
  }

  // 가중치 0 인 SKU 도 fallback 으로 포함 (모두 사용 가능)
  const sortedSkus = (Object.keys(score) as SkuKey[]).sort(
    (a, b) => score[b] - score[a],
  )

  return {
    priority_skus: sortedSkus,
    recommendation_messages: messages,
    guardrail_alerts: guardrails,
    vet_consult_recommended: vetConsult,
  }
}
