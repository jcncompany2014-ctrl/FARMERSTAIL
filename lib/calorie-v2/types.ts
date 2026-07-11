/**
 * 칼로리 알고리즘 v2 — 타입 (docs/CALORIE_ALGORITHM_SPEC_V2.md §4·§5).
 *
 * 스펙 원문 스키마 충실 구현. 기존 파이프라인(lib/nutrition.ts 등)과 독립 —
 * 연결(어댑터)은 1단계에서.
 */

export interface SurveyInputV2 {
  currentWeightKg: number
  ageYears: number
  sex: 'male' | 'female'
  isNeutered: boolean

  /** 견종 (플래그 소스). 목록 밖이면 'mixed' 또는 'unknown'. */
  breed: BreedKey

  // 생애단계
  lifeStage: 'puppy' | 'adult' | 'senior'
  isPregnant?: boolean
  isLactating?: boolean
  /** 자견 필수 — 성견 예상체중. */
  expectedAdultWeightKg?: number

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

  /** 건강 플래그 — 'none' 외 항목 있으면 수의 라우팅(계산 중단). */
  healthFlags: Array<
    | 'hypothyroid'
    | 'cushings'
    | 'diabetes'
    | 'cardiac'
    | 'renal'
    | 'other_illness'
    | 'none'
  >

  // 간식
  givesTreats: boolean
  treatKcalPerDay?: number

  // 급여 구성
  hwasikShare?: number
  hwasikSku: 'chicken' | 'duck' | 'pork' | 'beef'
  /** ⚠️ SKU별 실측값(설계값 금지). 화식은 고소화율이라 앳워터 부적합. */
  hwasikKcalPer100g: number

  // 건사료 (DB 우선 3단 폴백)
  kibbleProductId?: string
  kibbleKcalPer100g?: number
  kibbleGA?: GuaranteedAnalysis
  /** "목록에 없음"일 때 견주가 적은 사료명 — kibble_requests 로그(자가성장). */
  kibbleRawInput?: string
}

/** 건사료 성분표 (as-fed %) — 앳워터 폴백용. */
export interface GuaranteedAnalysis {
  crudeProtein: number
  crudeFat: number
  crudeFiber: number
  moisture: number
  ash: number
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

export type PlanPath =
  | 'adult'
  | 'weight_loss'
  | 'growth'
  | 'reproduction'
  | 'vet_referral'

export interface FeedingPlanV2 {
  path: PlanPath
  /** 3분해에서 역산된 BCS. */
  derivedBcs: number
  /** 반영된 견종 플래그(투명성). */
  breedFlags: BreedFlags
  idealWeightKg: number
  rer: number
  factor: number
  /** 계수 근거 사다리. */
  factorBreakdown: FactorLine[]
  der: number
  treatKcal: number
  mainPoolKcal: number
  hwasik: { kcal: number; grams: number; sku: string }
  kibble: {
    kcal: number
    grams: number | null
    source: 'db' | 'label' | 'atwater' | 'none'
  }
  notes: string[]
  isEstimate: true
}

/** 건사료 DB 인터페이스 (5단계에서 Supabase 구현체 연결 — 지금은 주입식). */
export interface KibbleDb {
  getProduct(id: string): Promise<{ kcalPer100g: number | null } | null>
  logMissing(rawInput: string): Promise<void>
}
