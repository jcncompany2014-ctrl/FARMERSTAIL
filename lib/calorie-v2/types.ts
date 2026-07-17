/**
 * 칼로리 알고리즘 v2 — 타입 (docs/CALORIE_ALGORITHM_SPEC_V2.md §4·§5).
 *
 * ⚠️ 스펙 원문의 전체 스키마가 아니라, **살아 있는 v2 부품이 실제로 받는 입력만**
 * 담는다. 상위 파이프라인(computeFeedingPlanV2 등)이 2026-07-17 삭제되면서
 * 그 전용 타입(`FeedingPlanV2`·`PlanPath`·`KibbleDb`·`GuaranteedAnalysis`)과
 * SurveyInputV2 의 미사용 필드(급여 구성·건사료·간식·건강 플래그 등)도 함께
 * 정리됐다. 스펙 원문 스키마는 docs/CALORIE_ALGORITHM_SPEC_V2.md 참조.
 *
 * 고객 급여량 정본은 `lib/nutrition.ts` 이고, 그쪽 입력 타입은 `DogInfo` ·
 * `SurveyAnswers` 다. 여기 타입과 혼동하지 말 것.
 */

/**
 * 성견 계수 사다리(`calculateAdultFactor`) + BCS 역산(`deriveBCS`) 의 입력.
 *
 * 실 설문 전체가 아니라 **사다리가 읽는 필드만**. 현행 프로덕션에선
 * `adapter.ts` 의 `legacyAdultLadder` 가 nutrition.ts 의 DogInfo/SurveyAnswers 를
 * 이 형태로 매핑해 넘긴다.
 */
export interface SurveyInputV2 {
  ageYears: number
  isNeutered: boolean

  /** 체형 3분해 (⚠️ "몇 점?" 직접질문 폐기 — deriveBCS 로 역산). */
  bodyAssessment: {
    ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard'
    waist: 'clear' | 'slight' | 'none'
    abdomen: 'tucked' | 'level' | 'sagging'
  }

  // 활동 (강도 + 증거수준)
  activityIntensity: 'low' | 'mid' | 'high'
  /** objective = 측정/웨어러블/사역 증거. 자가보고 가산은 +0.1 상한. */
  activityEvidence: 'self_report' | 'objective'
  isVeryInactive: boolean

  // 환경/체질
  housing: 'indoor' | 'indoor_outdoor' | 'outdoor'
  coldExposure: boolean
  /** 쉽게 찌는 체질 (설문 응답 — 견종 OB 플래그와 OR, 감산 1회). */
  isEasyKeeper: boolean
}

export type BreedKey =
  | 'maltese'
  | 'poodle_toy'
  | 'pomeranian'
  | 'shih_tzu'
  | 'bichon'
  | 'chihuahua'
  | 'welsh_corgi'
  | 'dachshund'
  | 'cocker_spaniel'
  | 'golden_retriever'
  | 'labrador'
  | 'jindo'
  | 'schnauzer_mini'
  | 'yorkshire'
  | 'french_bulldog'
  | 'mixed'
  | 'unknown'

/** 견종 플래그 — kcal 계수 아님. 동작 수정용 (스펙 §6 M4b). */
export interface BreedFlags {
  obeseProne: boolean
  toyOverestimate: boolean
  brachycephalic: boolean
  highDrive: boolean
  chondrodystrophic: boolean
}

/** 계수 사다리 한 줄 — UI 노출(투명성 = 마케팅 자산). */
export interface FactorLine {
  label: string
  delta: number
}
