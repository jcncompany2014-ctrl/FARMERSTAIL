import {
  bcsMerFactor,
  CONDITION_ADJUSTMENTS,
  GUIDELINE_VERSION,
  PREGNANCY_RER_MULTIPLIER,
  pregnancyTrimester,
  lactationRerMultiplier,
  type BcsKey,
  type ChronicConditionKey,
  type McsKey,
} from './nutrition/guidelines.ts'
import { legacyAdultLadder } from './calorie-v2/adapter.ts'
import { estimateIdealBodyWeight } from './calorie-v2/engine.ts'
import { breedFlagsFromLabel } from './calorie-v2/breeds.ts'
import type { FactorLine } from './calorie-v2/types.ts'

/**
 * 화식 라인 평균 에너지 밀도 (kcal/g).
 *
 * 검정 확정(2026-07-11) 4종 실측: 닭·돼지 1.15 / 오리·소 1.20 → 평균 1.175.
 * 연어(skin)는 제품 보류라 평균에서 제외 — 출시 시 재계산.
 * 라인 mix 정확 계산은 lines.ts dailyGramsFromMix. 이 상수는 라인 미정 시
 * 분석 페이지 단일 추정용.
 */
export const AVG_ENERGY_DENSITY_KCAL_PER_G = 1.175 // 검정 확정(2026-07-11): 닭·돼지 1.15 / 오리·소 1.20 평균

export type SurveyAnswers = {
  bodyCondition: 'skinny' | 'slim' | 'ideal' | 'chubby' | 'obese'
  allergies: string[]
  healthConcerns: string[]
  foodType?: string
  snackFreq?: string
  taste?: string
  // ── v2 확장 필드 (모두 옵션 — 기존 설문이 비어 있을 수 있음) ──
  /** WSAVA 9-point exact BCS. 입력되면 bodyCondition 보다 우선. */
  bcsExact?: BcsKey
  /**
   * 체중↔체형 모순 (사장님 2026-07-14 "살이 빠졌는데 체형이 더 뚱뚱해질 수는
   * 없잖아"). 설문 중 이전 분석과 비교해 감지되면(lib/bcs-consistency) 경고를
   * 띄우되 막지는 않고, 그대로 제출되면 이 필드로 넘어와 분석에 플래그로 남는다.
   * 계산 자체는 바꾸지 않는다 — 둘 중 뭐가 틀렸는지 알 수 없으므로.
   */
  bcsWeightConflict?: 'weight_down_bcs_up' | 'weight_up_bcs_down'
  /**
   * 체형 3분해 응답 (칼로리 v2 M2a — 갈비뼈·허리·배). "몇 점?" 직접질문 대신
   * 이 3문항에서 deriveBCS 로 역산한 값이 bcsExact 로 들어온다. 기록·재분석용.
   */
  bodyAssessment?: {
    ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard'
    waist: 'clear' | 'slight' | 'none'
    abdomen: 'tucked' | 'level' | 'sagging'
  }
  /** Muscle Condition Score 1~4 (1=정상, 4=중증 손실) */
  mcsScore?: McsKey
  /** Bristol Stool 1~7 (4=정상) */
  bristolScore?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** 만성질환 키 배열 — guidelines.ChronicConditionKey */
  chronicConditions?: ChronicConditionKey[]
  /** 현재 복용 약 / 보충제 자유 텍스트 */
  currentMedications?: string[]
  /** 임신/수유 상태 */
  pregnancyStatus?: 'none' | 'pregnant' | 'lactating'
  /** 임신 주차 1-9 (NRC 2006 §15: 6주차 이후 RER 급증). */
  pregnancyWeek?: number | null
  /** 수유 새끼 수 (NRC 2006: 1마리 RER × 2, 4마리 ×4, 8+마리 ×5+). */
  litterSize?: number | null
  /** 모질·피부 상태 */
  coatCondition?: 'healthy' | 'dull' | 'shedding' | 'itchy' | 'lesions'
  /** 식욕 */
  appetite?: 'strong' | 'normal' | 'picky' | 'reduced'
  /** 일일 산책 분 */
  dailyWalkMinutes?: number
  /**
   * 칼로리 v2 2d — 하루 간식 kcal (보호자 신고). 있으면 빈도 추정 대신 이 값을
   * 10% 캡으로 차감. 캡 초과 = 헤비유저 식별(TREAT_EXCESS 플래그).
   */
  treatKcalPerDay?: number
  /**
   * 칼로리 v2 5단계(M9b) — 현재 건사료 kcal/100g (라벨 신고, kcal/kg÷10).
   * mix 급여의 건사료 g 계산 정밀화(미입력 = 평균 350). 미인지 브랜드는
   * kibble_requests 자가성장 로그로.
   */
  kibbleKcalPer100g?: number
  // ── 칼로리 v2 2b — 사다리 감산·가산 신호 (2026-07-12) ──
  /** 쉽게 찌는 체질(easy-keeper) — 감산 −0.1 신호. 미입력 = 모름(무보정). */
  isEasyKeeper?: boolean
  /**
   * 격한 운동(달리기·등산·어질리티 등) 여부 + 증거 수준.
   * 'objective'(앱·웨어러블·기록)만 +0.2 가산 게이트 통과, 'self_report' 는 +0.1.
   */
  vigorousExercise?: 'none' | 'self_report' | 'objective'
  /** 주거 환경. */
  housing?: 'indoor' | 'indoor_outdoor' | 'outdoor'
  /** 한랭 노출 — 실외 거주와 동시일 때만 +0.15. */
  coldExposure?: boolean
  /** 현재 주식 브랜드명 */
  currentFoodBrand?: string
  // ── personalization v3 — 화식 비율 알고리즘 input ──
  // (마이그레이션 20260502000001 참조. 모든 필드 영양 calc 에는 미사용 —
  //  algorithm.ts 의 첫 박스 비율 결정 단계에서만 사용.)
  /** 보호자 메인 케어 목표 — 알고리즘 1순위 변수 */
  careGoal?:
    | 'weight_management'
    | 'skin_coat'
    | 'joint_senior'
    | 'allergy_avoid'
    | 'general_upgrade'
  /** 화식 경험 — 첫 박스 보수성 결정 */
  homeCookingExperience?: 'first' | 'occasional' | 'frequent'
  /** 현재 식이 만족도 1~5 — 4주차 비교 baseline */
  currentDietSatisfaction?: 1 | 2 | 3 | 4 | 5
  /** 최근 6개월 체중 추세 */
  weightTrend6mo?: 'stable' | 'gained' | 'lost' | 'unknown'
  /** 위장 민감도 — 사료 변경 시 변 무름 빈도 */
  giSensitivity?: 'rare' | 'sometimes' | 'frequent' | 'always'
  /** 선호 단백질 — 알레르기와 별개의 기호 신호 */
  preferredProteins?: Array<
    'chicken' | 'beef' | 'salmon' | 'pork' | 'lamb' | 'duck'
  >
  /** 산책 외 실내 활동 수준 */
  indoorActivity?: 'calm' | 'moderate' | 'active'
  /**
   * 수의사 진단 중증도 (질환별). 예: { pancreatitis: 'severe' }. firstBox 가
   * 췌장염 급성/중증 하드 게이트에 사용. calculateNutrition 은 미사용 —
   * surveys.answers JSONB 로 라이드해 compute route 가 알고리즘에 주입.
   */
  diagnosedSeverity?: Record<string, 'mild' | 'moderate' | 'severe'>
}

export type DogInfo = {
  weight: number
  /**
   * [발명 모듈 D] 체중 측정 신뢰도 0~1 (reliability.ts weightReliability).
   * 비대칭 케어목표(비만/저체중/자견)에서 안전 체중 보정 입력 — 신뢰도가
   * 낮을수록 안전한 쪽으로 체중 추정을 약하게 당긴다. undefined/null = 보정
   * 안 함 (하위호환). safetyWeightShift 참조.
   */
  weightReliability?: number | null
  ageValue: number
  ageUnit: 'years' | 'months'
  neutered: boolean
  activityLevel: 'low' | 'medium' | 'high'
  /** 임신/수유 적용 게이트 — 'female' 만 pregnancyStatus 반영. */
  gender?: 'male' | 'female' | null
  /**
   * 칼로리 v2 4단계 — 견종 라벨(dogs.breed, 한글). 플래그(비만경향·토이·단두종)
   * 파생용 — kcal 을 직접 바꾸지 않는다. 미입력 = 플래그 없음.
   */
  breed?: string | null
  /**
   * [A4] 예상 성견 체중 kg.
   *
   * lifeStage 임계 결정에 사용. 12개월 골든 puppy (현재 18kg) 가 성견 시
   * 30kg+ 라면 large breed puppy protocol (18mo) 이 적용돼야 — 단순 현재
   * 체중만 보면 medium 견으로 분류돼 12mo 에 adult 전환 + puppy factor 1.4
   * 손실. firstBox.ts 의 expectedAdultWeightKg 와 동일 신호.
   *
   * 미지정 / null / 0 시 dog.weight 그대로 사용 (이전 동작).
   */
  expectedAdultWeight?: number | null
}

export type BCSResult = {
  score: number
  label: string
  desc: string
  color: string
}

export type NutritionResult = {
  rer: number
  mer: number
  factor: number
  perMeal: number
  feedG: number
  stage: 'puppy' | 'adult' | 'senior'
  stageKR: string
  bcs: BCSResult
  protein: { pct: number; g: number }
  fat: { pct: number; g: number }
  carb: { pct: number; g: number }
  fiber: { pct: number; g: number }
  micro: Record<string, { val: number; unit: string; min: number }>
  caPRatio: string
  // ── v2 확장 ──
  /** 위험 플래그 — UI / AI 에 노출 */
  riskFlags: string[]
  /** 적용된 출처 키 (GUIDELINE_CITATIONS.key) */
  citations: string[]
  /** 수의사 상담 권장 여부 */
  vetConsult: boolean
  /** 가이드라인 버전 — reproducibility */
  guidelineVersion: string
  /** 계수 근거 사다리 (칼로리 v2 — UI 노출용 투명성). */
  factorBreakdown: FactorLine[]
  /** 이상체중 kg — BCS ≥6 감량 분기에서 RER 기준 체중 (그 외 = 입력 체중). */
  idealWeightKg: number
}

/**
 * 칼로리 v2 2e (경고 강화 절충 — 사장님 확정 2026-07-12) — 칼로리 수치가
 * "시작 참고치"임을 강하게 안내해야 하는 위험 플래그. 스펙의 "계산 중단"은
 * 구독 플로우 차단 + "긍정 먼저" 페이지 원칙과 충돌 → 계산은 제공하되
 * 에너지 카드 직하에 수의 상담 배너를 강제 노출.
 */
export const CALORIE_VET_ROUTE_FLAGS = new Set([
  'PREGNANT',
  'LACTATING',
  'DIABETIC_DIET_REQUIRED',
  'CKD_DIET_REQUIRED',
  'CARDIAC_LOW_SODIUM',
  'HYPOTHYROID_WEIGHT',
  'CUSHINGS_DIET',
  'HEPATIC_SUPPORT',
  'KETOGENIC_DIET',
  'EPI_ENZYME_REQUIRED',
  'LOW_FAT_REQUIRED',
  'REFEEDING_RISK',
])

/**
 * 체중↔체형 모순으로 제출된 분석인지 (사장님 2026-07-14). 별도 배너로 안내 —
 * CALORIE_VET_ROUTE_FLAGS 에 넣지 않는 이유는 그쪽 배너 문구가 임신·대사질환
 * 맥락이라 여기엔 맞지 않기 때문. 안내할 내용이 다르면 배너도 달라야 한다.
 */
export function hasBcsWeightConflict(
  riskFlags: string[] | null | undefined,
): boolean {
  return (riskFlags ?? []).includes('BCS_WEIGHT_CONFLICT')
}

/** 칼로리 카드 직하 수의 상담 배너 노출 여부. */
export function needsCalorieVetRoute(
  riskFlags: string[] | null | undefined,
): boolean {
  return (riskFlags ?? []).some((f) => CALORIE_VET_ROUTE_FLAGS.has(f))
}

function ageMonths(dog: DogInfo): number {
  return dog.ageUnit === 'years' ? dog.ageValue * 12 : dog.ageValue
}

/**
 * 생애주기 결정 — WSAVA 2021 + NRC 2006 size-aware.
 *
 *   - 모든 견종 12개월 미만: puppy (대형견은 18-24개월까지 puppy 인 경우도
 *     있으나 영양 측면에선 12개월 이후 성견 protocol 로 충분).
 *   - 소형 (<10kg): senior 9세+ (108개월)
 *   - 중형 (10-25kg): senior 7세+ (84개월)
 *   - 대형/초대형 (>25kg): senior 6세+ (72개월)
 *
 * 출처:
 *   - WSAVA 2021 Senior Care Guidelines
 *   - Hoskins (2003) Veterinary Geriatrics
 */
function lifeStage(dog: DogInfo): 'puppy' | 'adult' | 'senior' {
  const m = ageMonths(dog)
  // [A4] size 결정에 expectedAdultWeight 우선. 현재 weight 가 작아도
  // 성견 체중이 입력되면 그 사이즈 protocol 적용. 미입력 시 current
  // weight fallback.
  const sizeWeight =
    dog.expectedAdultWeight && dog.expectedAdultWeight > 0
      ? dog.expectedAdultWeight
      : dog.weight
  // Puppy threshold — size-aware (NRC 2006 + AAFCO 2024).
  //   - 소형 (<10kg): 12개월까지 puppy (조기 성숙)
  //   - 중형 (10-25kg): 12개월까지 puppy
  //   - 대형 (25-45kg): 18개월까지 puppy (성장 protocol 연장)
  //   - 초대형 (>45kg): 24개월까지 puppy
  const puppyThreshold =
    sizeWeight > 45 ? 24 : sizeWeight > 25 ? 18 : 12
  if (m < puppyThreshold) return 'puppy'
  // Senior threshold — size-aware (WSAVA 2021).
  const seniorThreshold =
    sizeWeight < 10 ? 108 : sizeWeight > 25 ? 72 : 84
  if (m >= seniorThreshold) return 'senior'
  return 'adult'
}

function lifeStageKR(stage: 'puppy' | 'adult' | 'senior'): string {
  if (stage === 'puppy') return '성장기 (퍼피)'
  if (stage === 'senior') return '노령기 (시니어)'
  return '성견 (유지기)'
}

function bcsScore(body: SurveyAnswers['bodyCondition'] | null | undefined): BCSResult {
  switch (body) {
    case 'skinny': return { score: 1, label: 'BCS 1-2', desc: '저체중 — 갈비뼈가 육안으로 확인됨', color: '#A6BEDA' }
    case 'slim': return { score: 3, label: 'BCS 3-4', desc: '약간 저체중 — 갈비뼈가 쉽게 촉진됨', color: '#8BA05A' }
    case 'ideal': return { score: 5, label: 'BCS 4-5', desc: '이상적 체중 — 허리 라인이 적절', color: '#6B7F3A' }
    case 'chubby': return { score: 7, label: 'BCS 6-7', desc: '과체중 — 갈비뼈 촉진이 어려움', color: '#D4B872' }
    case 'obese': return { score: 9, label: 'BCS 8-9', desc: '비만 — 지방 침착이 과도함', color: '#A0452E' }
    default:
      // [B1] bcsExact + bodyCondition 둘 다 null/undefined 시 crash 회피.
      // ideal (5) fallback — 보수적이고 voice-guidelines §4 부정 정보
      // 자제. 분석 결과 chip 에는 "체형 정보 미입력" 안내 별도.
      return { score: 5, label: 'BCS (미입력)', desc: '체형 정보 없음 — 이상 체중 가정', color: '#A0A0A0' }
  }
}

/** WSAVA 9점 정확 BCS → BCSResult 변환 (v2 — bcsExact 입력 시). */
function bcsScoreExact(score: BcsKey): BCSResult {
  if (score <= 2) return { score, label: `BCS ${score}/9`, desc: '심한 저체중 — 갈비뼈/등뼈/골반뼈 윤곽 가시', color: '#A6BEDA' }
  if (score <= 4) return { score, label: `BCS ${score}/9`, desc: '저체중 — 갈비뼈 쉽게 촉진, 허리 잘록', color: '#8BA05A' }
  if (score === 5) return { score, label: `BCS ${score}/9`, desc: '이상적 — 갈비뼈 만져지지만 안 보임', color: '#6B7F3A' }
  if (score <= 7) return { score, label: `BCS ${score}/9`, desc: '과체중 — 갈비뼈 만지기 어려움, 허리 라인 흐림', color: '#D4B872' }
  return { score, label: `BCS ${score}/9`, desc: '비만 — 갈비뼈 만지기 매우 어려움, 복부 처짐', color: '#A0452E' }
}

/**
 * [A3] RER 공식 weight tier 분기.
 *
 * NRC 2006 권장 70 × W^0.75 는 2~50kg 견에서 정확하지만 toy / giant 견은
 * 오차 큼:
 *  · ≤ 2kg (toy/신생견)   — Kleiber 의 mass^0.75 가 underestimate. 70×(W+2)^0.75 -
 *                          70×2^0.75 로 baseline 보정 (Kleiber 1947).
 *  · 2 ~ 50kg (mid)        — 표준 NRC 70×W^0.75.
 *  · > 50kg (giant/대형) — 대형견 metabolism rate ↓. 70×W^0.73 + 30 으로
 *                          완만한 곡선 (Hill 2014 retrospective).
 *
 * 결과적 ratio:
 *  W=1kg  : 70    (이전) vs 78   (new)
 *  W=5kg  : 234   (이전) ≈ 234   (new — mid range)
 *  W=30kg : 897   (이전) ≈ 897   (new — mid range)
 *  W=70kg : 1700  (이전) vs 1502 (new — giant)
 *
 * 평균 견(5~30kg)에는 영향 없음. 극단 견에만 적용.
 */
export function computeRer(weightKg: number): number {
  if (weightKg <= 2) {
    return 70 * Math.pow(weightKg + 2, 0.75) - 70 * Math.pow(2, 0.75) + 35
  }
  // audit #10: 이전 giant 분기 (W>50kg, ^0.73 + 47) 는 70kg 견에서 1502 kcal —
  // standard 70*W^0.75 (1697 kcal) 대비 ~200kcal underestimate. 출처 불분명.
  // NRC 2006 표준 70*W^0.75 로 통일 — 모든 체중 동일 공식. 거대견 metabolism
  // 차이는 activityLevel('low') 와 BCS factor 로 보정 (보호자가 활동량 신호로
  // 표현 가능). 50kg+ 견은 vetConsult flag 발화 (별도 calculateNutrition).
  return 70 * Math.pow(weightKg, 0.75)
}

/**
 * 간식 칼로리 비중 — 보호자 간식 빈도 → 1일 칼로리 중 간식 추정 비율.
 *
 * AAFCO / WSAVA "10% 룰": 간식·트릿은 1일 총칼로리의 10% 이내, 나머지 90%+
 * 는 완전균형식에서. 보호자가 간식을 주면 그만큼 **완전식(밥)을 줄여** 총섭취
 * 를 MER 로 유지한다 — 간식 위에 밥을 풀로 주면 과급 → 비만 (국내 반려견
 * 비만의 최대 경로). 한국 현실 반영해 보수적으로 추정:
 *   · 거의 안 줌 / 미입력 → 0%
 *   · 가끔            → 5%
 *   · 매일            → 10% (룰 상한)
 * 출처: AAFCO 2024 Treat/Snack guidance, WSAVA Global Nutrition Toolkit.
 */
export function treatCalorieFraction(snackFreq?: string | null): number {
  switch (snackFreq) {
    case '매일':
      return 0.1
    case '가끔':
      return 0.05
    default:
      return 0
  }
}

/**
 * [발명 모듈 D] 신뢰도 기반 안전 체중 보정 — 신뢰도를 영양 처방에 반영.
 *
 * 체중 측정 신뢰도가 낮으면 참 체중이 ±로 퍼져 있다(눈대중 10kg → 8~12kg).
 * 불확실성 자체는 중심값을 위로도 아래로도 밀지 않는다 — 평균적으론 입력값이
 * 최선 추정이라, 신뢰도 낮다고 기계적으로 깎으면 멀쩡한 강아지를 굶긴다.
 * 그래서 **케어목표가 비대칭일 때만** 안전한 쪽으로 기운다 (asymmetric loss):
 *   · 과급 위험(비만 BCS≥7 또는 체중관리 목표): 불확실 → 낮은 체중 (덜 급여)
 *   · 저급 위험(저체중 BCS≤3 또는 성장기 자견): 불확실 → 높은 체중 (더 급여)
 *   · 대칭(BCS 4-6 일반 유지): 보정 0 (중심값 그대로 — 데이터 부실로 굶기지 X)
 * 강도 = 방향 × MAX_SHIFT(0.08) × (1 − 신뢰도). 신뢰도 1.0(동물병원)=0%,
 * 0.4(눈대중)=±4.8%, 0=±8%. 비만은 이미 bcsMerFactor(×0.75)로 한 번 줄어드니
 * 이중감산 방지로 8% 보수. 신뢰도 미입력=무변경(하위호환).
 * 출처: 비대칭 손실 Berger (1985) Statistical Decision Theory; 측정 신뢰도
 * reliability.ts (발명 모듈 C).
 */
export function safetyWeightShift(
  weightKg: number,
  weightReliability: number | null | undefined,
  ctx: { bcsScore: number; careGoal?: string | null; stage: string },
): number {
  if (weightReliability == null) return weightKg
  const uncertainty = 1 - Math.max(0, Math.min(1, weightReliability))
  if (uncertainty <= 0) return weightKg

  const overfeedRisk = ctx.bcsScore >= 7 || ctx.careGoal === 'weight_management'
  const underfeedRisk = ctx.bcsScore <= 3 || ctx.stage === 'puppy'
  // 방향: 과급 위험 우선 (동시 충돌 시 보수적으로 덜 급여). 대칭이면 0.
  const direction = overfeedRisk ? -1 : underfeedRisk ? 1 : 0
  if (direction === 0) return weightKg

  const MAX_SHIFT = 0.08
  const shifted = weightKg * (1 + direction * MAX_SHIFT * uncertainty)
  return Math.max(0.5, Math.min(100, shifted))
}

export function calculateNutrition(dog: DogInfo, answers: SurveyAnswers): NutritionResult {
  // weight 가드 — 0/음수/비정상 입력 시 NaN/Infinity 폭주 차단.
  // 강아지 0.5kg ~ 100kg 합리적 범위로 clamp. 0 이면 RER=0 → MER=0 → 분석
  // 의미 없음. 0.5kg 최소로 가정 (소형견 신생아 ~250g, 분양 가능 최소).
  const w0 = Math.max(0.5, Math.min(100, dog.weight || 0.5))
  const stage = lifeStage(dog)

  // BCS — 정확 입력(v2) 우선, 없으면 5단계 매핑
  const bcs = answers.bcsExact
    ? bcsScoreExact(answers.bcsExact)
    : bcsScore(answers.bodyCondition)

  // [발명 모듈 D] 신뢰도→처방 반영. 비대칭 케어목표(비만/저체중/자견)에서
  // 체중 신뢰도가 낮을수록 안전한 쪽으로 체중 추정을 약하게 당긴다 (대칭·
  // 고신뢰도/미입력은 무변경). RER 입력 체중에만 1회 적용 — safetyWeightShift.
  const w = safetyWeightShift(w0, dog.weightReliability, {
    bcsScore: bcs.score,
    careGoal: answers.careGoal,
    stage,
  })
  let RER = computeRer(w) // BCS≥6 감량 분기에서 이상체중(IBW)으로 재계산됨
  let ibwKg = w

  let factor = 1.0
  let factorBreakdown: FactorLine[] = []
  const riskFlags: string[] = []
  const citations = new Set<string>(['nrc2006', 'aafco2024', 'fediaf2021'])
  let vetConsult = false

  // audit #10: 거대견 (50kg+) — metabolism rate 가 표준 NRC 공식보다 낮을 수
  // 있어 표준 RER 사용 시 과식 위험. activityLevel='low' 권장 + 수의사 상담
  // flag. 안전보정 전 원체중(w0) 기준 — 측정 실측이 거대견 분류 신호.
  if (w0 >= 50) {
    riskFlags.push('GIANT_BREED')
    vetConsult = true
  }

  // [발명 모듈 D] 신뢰도 안전보정이 실제 적용됐으면 플래그 — 분석 페이지가
  // "측정 정밀도가 낮아 보수적으로 계산했어요" 안내 + 측정 유도에 사용.
  if (Math.abs(w - w0) > 0.05) riskFlags.push('RELIABILITY_SAFETY_ADJUST')

  // 체중↔체형 모순 — 설문에서 경고했는데도 그대로 제출된 경우. 계산은 그대로
  // 하되(둘 중 뭐가 틀렸는지 알 수 없다) 분석에 남겨 수의 상담을 권한다.
  if (answers.bcsWeightConflict) {
    riskFlags.push('BCS_WEIGHT_CONFLICT')
    vetConsult = true
  }

  // ── 에너지 계수 — 칼로리 알고리즘 v2 (감산 지배형 사다리) ──
  //
  // docs/CALORIE_ALGORITHM_SPEC_V2.md §6. 이전 곱셈 체인(활동 base 1.2/1.57/1.8
  // × bcsMerFactor × 중성화 0.9)은 폐기 — 저활동 보수치에 중성화 0.9 가 중첩되는
  // 이중차감 + 곱셈 스택 문제. v2 는 BASE 1.4(중성화·실내·저활동 = 한국 모달에
  // 이미 포함)에 가산/감산 델타만, 클램프 [1.0, 2.0].
  //
  // 1단계 연결 범위(사장님 확정 2026-07-12):
  //  - 성견/노령: v2 사다리 (BCS 는 현행 직접선택 값 주입 — 3분해는 2단계)
  //  - BCS≥6: v2 감량 분기 — RER 을 이상체중(IBW)으로 재계산, 계수 1.0 시작
  //  - 자견: 간이 근사 유지(성견 예상체중 질문 추가 후 NRC 정확식 — 2단계)
  //  - 임신/수유: NRC REPLACE 계산 유지 + vetConsult (수의 라우팅 UI = 2단계)
  const ladderBcs = (answers.bcsExact ?? bcs.score) as number
  // 칼로리 v2 4단계 — 견종 플래그 (OB→easy-keeper OR·BRA→활동 억제·TOY→자견 −15%).
  const breedFlags = breedFlagsFromLabel(dog.breed)
  if (stage === 'puppy') {
    const m = ageMonths(dog)
    const adultKg =
      dog.expectedAdultWeight && dog.expectedAdultWeight > 0
        ? dog.expectedAdultWeight
        : null
    if (adultKg) {
      // 칼로리 v2 2c — NRC 2006 성장 정확식: 130×BW^0.75×3.2×(e^−0.87p−0.1).
      // ⚠️ 앞 상수 130 (70 이면 ~46% 과소 — 스펙 가드레일 8). factor 는 RER
      // 대비 비율로 역산해 기존 MER=RER×factor 파이프라인 유지(MER=round(der)).
      // 토이 견종 −15% 하향은 4단계(견종 플래그)에서.
      const p = Math.min(1, w / adultKg)
      let der = 130 * Math.pow(w, 0.75) * 3.2 * (Math.exp(-0.87 * p) - 0.1)
      // 토이 견종 — NRC 표준식 과대추정 보정 (~15% 하향, 스펙 §6 M6).
      if (breedFlags.toyOverestimate) der *= 0.85
      factor = der / RER
      factorBreakdown = [
        {
          label: `성장기 정확식 — 성장률 ${Math.round(p * 100)}% (NRC 130${breedFlags.toyOverestimate ? ' · 토이 −15%' : ''})`,
          delta: +factor.toFixed(2),
        },
      ]
    } else {
      // 성견 예상체중 미입력 — 간이 근사 폴백 (나이 단계).
      if (m < 4) factor = 3.0
      else if (m < 8) factor = 2.5
      else factor = 2.0
      factorBreakdown = [
        { label: `성장기(${m}개월) — 간이 근사 ×${factor}`, delta: factor },
      ]
    }
  } else if (ladderBcs >= 6) {
    // v2 감량 분기 (M2b·M5) — 과체중은 이상체중 기준 RER × 1.0 에서 시작.
    // (이전: 현재 체중 RER × bcsMerFactor 0.75~0.9 곱셈)
    ibwKg = estimateIdealBodyWeight(w, ladderBcs)
    RER = computeRer(ibwKg)
    factor = 1.0
    factorBreakdown = [
      { label: `감량 시작 — 이상체중 ${ibwKg}kg 기준 ×1.0`, delta: 1.0 },
    ]
    citations.add('wsava')
  } else {
    // v2 성견 사다리 (M4). BCS 1(refeeding 위험)은 저체중 +0.2 가산을 걸지
    // 않고 baseline 유지 — 단계적 증량은 수의 지도(audit #11 특례 유지).
    const ladder = legacyAdultLadder({
      ageYears: ageMonths(dog) / 12,
      isNeutered: dog.neutered,
      activityLevel: dog.activityLevel,
      dailyWalkMinutes: answers.dailyWalkMinutes,
      bcs: ladderBcs === 1 ? 5 : ladderBcs,
      // 2b 설문 신호 — 미입력 시 보수 기본값 (감산·가산 미발동).
      isEasyKeeper: answers.isEasyKeeper,
      vigorousExercise: answers.vigorousExercise,
      housing: answers.housing,
      coldExposure: answers.coldExposure,
      // 4단계 — 견종 플래그 (엔진이 OB↔easy-keeper OR 감산 1회·BRA 억제 처리).
      breedFlags,
    })
    factor = ladder.factor
    factorBreakdown = ladder.lines
  }

  // BCS 위험 플래그 — factor 는 위 사다리/감량 분기에서 이미 반영됨.
  if (answers.bcsExact) {
    citations.add('wsava')
    if (answers.bcsExact >= 8) {
      riskFlags.push('SEVERE_OBESITY')
      vetConsult = true
    } else if (answers.bcsExact >= 7) {
      riskFlags.push('OVERWEIGHT')
    } else if (answers.bcsExact === 1) {
      riskFlags.push('SEVERE_UNDERWEIGHT')
      riskFlags.push('REFEEDING_RISK')
      vetConsult = true
    } else if (answers.bcsExact === 2) {
      riskFlags.push('SEVERE_UNDERWEIGHT')
      vetConsult = true
    } else if (answers.bcsExact <= 3) {
      riskFlags.push('UNDERWEIGHT')
    }
  }

  // 임신/수유 보정 (NRC 2006 §15). female + non-neutered 만 적용 — 수컷/
  // 중성화견에 임신/수유 잘못 켜져도 factor 폭주 차단.
  //
  // # 중요 (audit fix v1.6.1):
  // NRC formula 는 RER × multiplier (absolute), maintenance activity 와
  // stack 하면 안 됨. 임신/수유 중에는 영양 요구의 대부분이 태아 성장 / 우유
  // 생산이라 maintenance MER 은 의미 없음. activity base 를 REPLACE.
  // BCS 보정은 그대로 적용 (저체중 mom 은 더 먹어야).
  const canBePregnantOrLactating =
    !dog.neutered && (dog.gender === 'female' || dog.gender == null)
  if (canBePregnantOrLactating && answers.pregnancyStatus === 'pregnant') {
    // audit #12: PREGNANCY_RER_MULTIPLIER SSOT (guidelines.ts) 사용. 이전엔
    // chip 과 factor 분리 → 보호자 신뢰 깨짐. firstBox.applyPregnancyNote 와
    // 같은 trimester 값 보장.
    const trimester = pregnancyTrimester(answers.pregnancyWeek ?? null)
    const pregFactor = PREGNANCY_RER_MULTIPLIER[trimester]
    const bcsModifier =
      typeof answers.bcsExact === 'number'
        ? bcsMerFactor(answers.bcsExact)
        : 1.0
    factor = pregFactor * bcsModifier
    factorBreakdown = [
      { label: `임신(NRC ×${pregFactor}) — 수의 상담 권장`, delta: factor },
    ]
    riskFlags.push('PREGNANT')
    vetConsult = true
  } else if (
    canBePregnantOrLactating &&
    answers.pregnancyStatus === 'lactating'
  ) {
    // audit #12: lactationRerMultiplier SSOT (guidelines.ts) 사용.
    const lactFactor = lactationRerMultiplier(answers.litterSize ?? null)
    const bcsModifier =
      typeof answers.bcsExact === 'number'
        ? bcsMerFactor(answers.bcsExact)
        : 1.0
    factor = lactFactor * bcsModifier
    factorBreakdown = [
      { label: `수유(NRC ×${lactFactor}) — 수의 상담 권장`, delta: factor },
    ]
    riskFlags.push('LACTATING')
    vetConsult = true
  }

  // MCS 보정 — 근손실 있으면 단백질 % 증가만, MER 은 그대로
  // (별도 변수에 저장 후 매크로 분기에서 사용)

  // Factor 최대 cap — NRC 2006 §15 가장 극단 케이스 (8+ pups lactating
  // + underweight) 도 5.0× 이하. 그 이상은 입력 오류로 간주 — clamp + flag.
  // 최소도 RER × 0.5 = AAFCO 강제 감량 protocol 하한 (BCS 9 의 0.75 × 중성화
  // 0.9 = 0.675 정상 범위).
  if (factor > 5.0) {
    riskFlags.push('FACTOR_CAPPED_HIGH')
    factor = 5.0
  } else if (factor < 0.5) {
    riskFlags.push('FACTOR_CAPPED_LOW')
    factor = 0.5
  }

  const MER = Math.round(RER * factor)

  // 간식 칼로리 차감 — 간식만큼 완전식(밥)을 줄여 총섭취를 MER 로 유지 (10%
  // 룰). 간식 위에 밥을 풀로 주면 과급 → 비만. MER(요구량)은 그대로 두고
  // feedG(권장 급여 그램)에만 반영. snackFreq 미입력/거의 안 줌이면 0 (무변경).
  // 칼로리 v2 2d — 간식 kcal 신고값 우선 (10% 캡 차감 — 완전식 90%+ 보장).
  // 캡 초과 신고 = 헤비유저 식별(TREAT_EXCESS: "간식 줄이기" 코칭 + M10 수렴
  // 대상). 미신고 = 빈도 추정(가끔 5% / 매일 10%) — 기존 동작 유지.
  const treatCap = MER * 0.1
  const reportedTreat = answers.treatKcalPerDay
  const treatKcalDeducted =
    reportedTreat != null && reportedTreat >= 0
      ? Math.min(reportedTreat, treatCap)
      : MER * treatCalorieFraction(answers.snackFreq)
  // 캡 초과 = 코칭 대상 플래그만 (수의 상담 강제 아님).
  if (reportedTreat != null && reportedTreat > treatCap) {
    riskFlags.push('TREAT_EXCESS')
  }
  if (treatKcalDeducted >= treatCap) riskFlags.push('TREAT_LOAD_DAILY')
  const foodKcal = Math.round(MER - treatKcalDeducted)

  // ── 매크로 분기 (NRC + AAFCO 권장 범위 내) ──
  let proteinPct, fatPct, carbPct, fiberPct
  if (stage === 'puppy') {
    proteinPct = 32; fatPct = 22; carbPct = 38; fiberPct = 4
  } else if (stage === 'senior') {
    proteinPct = 30; fatPct = 14; carbPct = 44; fiberPct = 6
  } else {
    if (bcs.score >= 7) { proteinPct = 35; fatPct = 12; carbPct = 40; fiberPct = 7 }
    else if (bcs.score <= 3) { proteinPct = 30; fatPct = 22; carbPct = 40; fiberPct = 4 }
    else { proteinPct = 30; fatPct = 18; carbPct = 42; fiberPct = 5 }
  }

  // 레거시 healthConcerns (v1 호환)
  if (answers.healthConcerns.includes('체중')) { proteinPct += 3; fatPct -= 3 }
  if (answers.healthConcerns.includes('피부/털')) { fatPct += 3; carbPct -= 3 }
  if (answers.healthConcerns.includes('소화')) { fiberPct += 2; carbPct -= 2 }
  if (answers.healthConcerns.includes('관절')) { proteinPct += 2; carbPct -= 2 }
  if (answers.healthConcerns.includes('신장')) { proteinPct -= 4; carbPct += 4 }

  // MCS — 근손실 시 단백질 +
  if (answers.mcsScore && answers.mcsScore >= 2) {
    const boost = answers.mcsScore - 1   // MCS 2: +1, 3: +2, 4: +3
    proteinPct += boost * 2
    fatPct -= boost
    carbPct -= boost
    if (answers.mcsScore >= 3) {
      riskFlags.push('MUSCLE_LOSS')
      vetConsult = true
    }
    citations.add('wsava')
  }

  // Bristol stool 신호
  if (answers.bristolScore !== undefined) {
    if (answers.bristolScore <= 2) {
      fiberPct += 3   // 변비
      riskFlags.push('CONSTIPATION')
    } else if (answers.bristolScore >= 6) {
      fiberPct += 2   // 가용성 섬유
      riskFlags.push(answers.bristolScore === 7 ? 'DIARRHEA' : 'LOOSE_STOOL')
      if (answers.bristolScore === 7) vetConsult = true
    }
  }

  // ── 만성질환 분기 (CONDITION_ADJUSTMENTS 적용) ──
  const microFactors: {
    phosphorus?: number
    sodium?: number
    omega3?: number
    omega6?: number
    zinc?: number
    calcium?: number
  } = {}
  const conditionSupplements = new Set<string>()

  // audit 2-15: 만성 질환이 두 가지 이상 선택됐을 때, delta 가 서로 상쇄/충돌
  // 하는지 추적. 예: 신장병(저단백) + 근육감소(고단백) → 둘이 0 으로 상쇄돼도
  // 권장은 둘 다 못 만족함. 자동 매크로 비율이 의미 없어지므로 수의사 상담
  // flag.
  const chronicCount = (answers.chronicConditions ?? []).length
  const proteinDeltas: number[] = []
  const fatDeltas: number[] = []

  for (const cond of answers.chronicConditions ?? []) {
    const adj = CONDITION_ADJUSTMENTS[cond]
    if (!adj) continue
    proteinDeltas.push(adj.proteinDelta)
    fatDeltas.push(adj.fatDelta)
    proteinPct += adj.proteinDelta
    fatPct += adj.fatDelta
    carbPct += adj.carbDelta
    fiberPct += adj.fiberDelta
    for (const flag of adj.riskFlags) riskFlags.push(flag)
    for (const c of adj.cite) citations.add(c)
    for (const s of adj.supplements) conditionSupplements.add(s)
    if (adj.vetConsult) vetConsult = true
    if (adj.micro?.phosphorusFactor !== undefined) {
      microFactors.phosphorus = Math.min(microFactors.phosphorus ?? 1, adj.micro.phosphorusFactor)
    }
    if (adj.micro?.sodiumFactor !== undefined) {
      microFactors.sodium = Math.min(microFactors.sodium ?? 1, adj.micro.sodiumFactor)
    }
    if (adj.micro?.omega3Factor !== undefined) {
      microFactors.omega3 = Math.max(microFactors.omega3 ?? 1, adj.micro.omega3Factor)
    }
    if (adj.micro?.omega6Factor !== undefined) {
      microFactors.omega6 = Math.max(microFactors.omega6 ?? 1, adj.micro.omega6Factor)
    }
    if (adj.micro?.zincFactor !== undefined) {
      microFactors.zinc = Math.max(microFactors.zinc ?? 1, adj.micro.zincFactor)
    }
    if (adj.micro?.calciumFactor !== undefined) {
      microFactors.calcium = Math.min(microFactors.calcium ?? 1, adj.micro.calciumFactor)
    }
  }

  // audit 2-15: chronic delta 충돌 감지. 한 매크로 안에서 양수/음수 delta 가
  // 동시에 있으면 conditions 간 권장이 모순 → 수의사 상담 강제.
  if (chronicCount >= 2) {
    const hasPosProtein = proteinDeltas.some((d) => d > 0)
    const hasNegProtein = proteinDeltas.some((d) => d < 0)
    const hasPosFat = fatDeltas.some((d) => d > 0)
    const hasNegFat = fatDeltas.some((d) => d < 0)
    if ((hasPosProtein && hasNegProtein) || (hasPosFat && hasNegFat)) {
      riskFlags.push('CHRONIC_CONFLICT')
      vetConsult = true
    }
  }

  // [H2] MCS(근손실 → 단백질 ↑)는 chronicConditions 가 아니라 별도 신호라 위
  // chronicCount 충돌 감지에서 빠졌었음. 가장 위험한 조합 — CKD/간질환(단백
  // 제한) + 근손실(단백 보강) — 이 silent 로 절충 평균돼 둘 다 못 맞추던 걸
  // 명시 충돌로 승격. 수의사가 우선순위(보통 신장 제한 우선)를 정해야 함.
  if (
    answers.mcsScore != null &&
    answers.mcsScore >= 2 &&
    proteinDeltas.some((d) => d < 0)
  ) {
    if (!riskFlags.includes('CHRONIC_CONFLICT')) {
      riskFlags.push('CHRONIC_CONFLICT')
    }
    vetConsult = true
  }

  // 매크로 합 100 정규화 (audit fix — 이전 carb 에 max(20, ...) 강제로 합이
  // 110% 까지 갈 수 있었음. 예: protein 50 + fat 30 + fiber 10 + carb 20 = 110).
  // protein/fat/fiber 클램프 + 정수 반올림 후 carb 가 잔량을 흡수. carb 음수
  // 면 비례 축소 (극단 chronic + MCS combo).
  proteinPct = Math.round(Math.max(15, Math.min(50, proteinPct)))
  fatPct = Math.round(Math.max(8, Math.min(30, fatPct)))
  fiberPct = Math.round(Math.max(2, Math.min(10, fiberPct)))
  carbPct = 100 - proteinPct - fatPct - fiberPct
  if (carbPct < 0) {
    // protein + fat + fiber 합 > 100 — 비례 축소.
    const overflow = -carbPct
    const total = proteinPct + fatPct + fiberPct
    proteinPct = Math.round(proteinPct - overflow * (proteinPct / total))
    fatPct = Math.round(fatPct - overflow * (fatPct / total))
    fiberPct = Math.round(fiberPct - overflow * (fiberPct / total))
    carbPct = Math.max(0, 100 - proteinPct - fatPct - fiberPct)
  }
  // Math.round 누적 오차로 합이 99 또는 101 이 될 수 있음 — carb 가 잔차 흡수
  // (가장 큰 매크로라 1-2% 변동 영향 최소).
  const macroSum = proteinPct + fatPct + carbPct + fiberPct
  if (macroSum !== 100) {
    carbPct = Math.max(0, carbPct + (100 - macroSum))
  }

  const proteinG = Math.round((MER * proteinPct / 100) / 4)
  const fatG = Math.round((MER * fatPct / 100) / 9)
  const carbG = Math.round((MER * carbPct / 100) / 4)
  const fiberG = Math.round((MER * fiberPct / 100) / 4)

  // 미량영양소 (AAFCO 2024, /1000kcal ME)
  const microBase = stage === 'puppy'
    ? {
        calcium: { min: 3.0, rec: 4.5, unit: 'g' },
        phosphorus: { min: 2.5, rec: 3.5, unit: 'g' },
        omega6: { min: 3.3, rec: 5.0, unit: 'g' },
        omega3: { min: 0.2, rec: 0.5, unit: 'g' },
        vitA: { min: 1250, rec: 2500, unit: 'IU' },
        vitD: { min: 125, rec: 250, unit: 'IU' },
        vitE: { min: 12.5, rec: 25, unit: 'IU' },
        zinc: { min: 25, rec: 40, unit: 'mg' },
        iron: { min: 22, rec: 35, unit: 'mg' },
        copper: { min: 3.1, rec: 5, unit: 'mg' },
      }
    : {
        calcium: { min: 1.25, rec: 2.5, unit: 'g' },
        phosphorus: { min: 1.0, rec: 2.0, unit: 'g' },
        omega6: { min: 2.8, rec: 5.0, unit: 'g' },
        omega3: { min: 0.11, rec: 0.4, unit: 'g' },
        vitA: { min: 1250, rec: 2500, unit: 'IU' },
        vitD: { min: 125, rec: 250, unit: 'IU' },
        vitE: { min: 12.5, rec: 25, unit: 'IU' },
        zinc: { min: 20, rec: 35, unit: 'mg' },
        iron: { min: 10, rec: 25, unit: 'mg' },
        copper: { min: 1.85, rec: 4, unit: 'mg' },
      }

  const daily: Record<string, { val: number; unit: string; min: number }> = {}
  for (const k in microBase) {
    const m = microBase[k as keyof typeof microBase]
    daily[k] = {
      val: +(m.rec * MER / 1000).toFixed(2),
      unit: m.unit,
      min: +(m.min * MER / 1000).toFixed(2),
    }
  }

  if (answers.healthConcerns.includes('피부/털')) {
    daily.omega3!.val *= 1.5
    daily.omega6!.val *= 1.2
    daily.zinc!.val *= 1.3
  }
  if (answers.healthConcerns.includes('관절')) daily.omega3!.val *= 1.5
  if (answers.healthConcerns.includes('신장')) daily.phosphorus!.val *= 0.7

  // v2: 만성질환 micro factors 적용 (가장 보수적인 값 사용 — 위 microFactors 가
  // 이미 min/max 로 결합됨).
  if (microFactors.phosphorus !== undefined) daily.phosphorus!.val *= microFactors.phosphorus
  if (microFactors.omega3 !== undefined) daily.omega3!.val *= microFactors.omega3
  if (microFactors.omega6 !== undefined) daily.omega6!.val *= microFactors.omega6
  if (microFactors.zinc !== undefined) daily.zinc!.val *= microFactors.zinc
  if (microFactors.calcium !== undefined) daily.calcium!.val *= microFactors.calcium

  // 모질·피부 condition (v2)
  if (answers.coatCondition === 'dull' || answers.coatCondition === 'shedding') {
    daily.omega3!.val *= 1.3
    daily.zinc!.val *= 1.2
  } else if (answers.coatCondition === 'itchy' || answers.coatCondition === 'lesions') {
    daily.omega3!.val *= 1.5
    daily.zinc!.val *= 1.3
    riskFlags.push('SKIN_BARRIER_COMPROMISED')
  }

  for (const k in daily) daily[k]!.val = +daily[k]!.val.toFixed(2)

  const caPRatio = (daily.calcium!.val / daily.phosphorus!.val).toFixed(1)

  return {
    rer: Math.round(RER),
    mer: MER,
    factor: +factor.toFixed(2),
    perMeal: Math.round(MER / 2),
    // feedG — 화식 평균 에너지 밀도(검정 확정 1.175 kcal/g) 기준. 간식 차감된
    // foodKcal 기준 (간식 위에 풀 밥 방지). 라인 mix 가 정해지면 lines.ts
    // dailyGramsFromMix 가 가중평균으로 정밀 재계산.
    feedG: Math.round(foodKcal / AVG_ENERGY_DENSITY_KCAL_PER_G),
    stage,
    stageKR: lifeStageKR(stage),
    bcs,
    protein: { pct: proteinPct, g: proteinG },
    fat: { pct: fatPct, g: fatG },
    carb: { pct: carbPct, g: carbG },
    fiber: { pct: fiberPct, g: fiberG },
    micro: daily,
    caPRatio,
    // v2 신규
    riskFlags: Array.from(new Set(riskFlags)),
    citations: Array.from(citations),
    vetConsult,
    guidelineVersion: GUIDELINE_VERSION,
    factorBreakdown,
    idealWeightKg: +ibwKg.toFixed(2),
  }
}

/** 만성질환별 추가 보충제 키 (UI 표시용 — getSupplements 에 합치지 않고 별도). */
export function getConditionSupplements(
  conditions: ChronicConditionKey[] | undefined,
): string[] {
  const set = new Set<string>()
  for (const c of conditions ?? []) {
    const adj = CONDITION_ADJUSTMENTS[c]
    for (const s of adj?.supplements ?? []) set.add(s)
  }
  return Array.from(set)
}

export type MacroRange = { min: number; max: number; scale: number }
export type AAFCORanges = {
  protein: MacroRange
  fat: MacroRange
  carb: MacroRange
  fiber: MacroRange
}

/**
 * AAFCO 2024 권장 범위 (%DM basis 대략치).
 * - min: AAFCO 최소 요구량 (또는 실무 하한)
 * - max: 산업 평균 상한 (과다 섭취 주의 구간 시작점)
 * - scale: 막대 그래프의 축 상한 (시각화용)
 */
export function getAAFCORanges(
  stage: 'puppy' | 'adult' | 'senior'
): AAFCORanges {
  if (stage === 'puppy') {
    return {
      protein: { min: 22.5, max: 40, scale: 50 },
      fat: { min: 8.5, max: 30, scale: 40 },
      carb: { min: 30, max: 50, scale: 60 },
      fiber: { min: 2, max: 5, scale: 10 },
    }
  }
  if (stage === 'senior') {
    return {
      protein: { min: 25, max: 35, scale: 45 },
      fat: { min: 8, max: 18, scale: 30 },
      carb: { min: 35, max: 55, scale: 65 },
      fiber: { min: 4, max: 8, scale: 12 },
    }
  }
  return {
    protein: { min: 18, max: 35, scale: 45 },
    fat: { min: 5.5, max: 22, scale: 32 },
    carb: { min: 30, max: 50, scale: 60 },
    fiber: { min: 3, max: 7, scale: 10 },
  }
}

/**
 * DB에 저장된 한글 생애주기 문자열(`stageKR`)을 raw enum으로 역매핑.
 * 알려지지 않은 값은 'adult'로 폴백.
 */
export function stageFromKR(kr: string | null | undefined): 'puppy' | 'adult' | 'senior' {
  if (!kr) return 'adult'
  if (kr.includes('퍼피') || kr.includes('성장')) return 'puppy'
  if (kr.includes('시니어') || kr.includes('노령')) return 'senior'
  return 'adult'
}

export function getSupplements(concerns: string[]): Array<{ emoji: string; name: string; desc: string }> {
  const s: Array<{ emoji: string; name: string; desc: string }> = []
  if (concerns.includes('피부/털')) {
    s.push({ emoji: '🐟', name: '오메가-3 (EPA/DHA)', desc: '피부 장벽 강화, 모질 개선' })
    s.push({ emoji: '🧬', name: '아연 (Zinc)', desc: '피부 세포 영양 보조' })
  }
  if (concerns.includes('관절')) {
    s.push({ emoji: '🦴', name: '글루코사민 + 콘드로이틴', desc: '연골 보호, 관절 윤활' })
    // R86-D1: 사료관리법 §13 / 표시광고법 §3 — "통증 완화/항염" 의약품 효능
    // 오인 표현 금지. 식이 보조 표현으로.
    s.push({ emoji: '🌿', name: '초록입홍합', desc: '오메가-3 · 관절 윤활 보조' })
  }
  if (concerns.includes('소화')) {
    s.push({ emoji: '🦠', name: '프로바이오틱스', desc: '장내 유익균 영양 보조' })
    s.push({ emoji: '🎃', name: '식이섬유 보충', desc: '장 운동 보조, 변 상태 도움' })
  }
  if (concerns.includes('체중')) {
    s.push({ emoji: '🔥', name: 'L-카르니틴', desc: '체중 케어 영양 보조' })
  }
  if (concerns.includes('신장')) {
    s.push({ emoji: '💧', name: '수분 보충 강화', desc: '저인 식이와 충분한 수분' })
    s.push({ emoji: '🌱', name: '오메가-3 (EPA)', desc: '신장 영양 보조' })
  }
  if (concerns.includes('치아')) {
    s.push({ emoji: '🦷', name: '치석 관리 효소', desc: '치태 분해 효소' })
  }
  if (s.length === 0) {
    s.push({ emoji: '✅', name: '기본 종합비타민/미네랄', desc: 'AAFCO 기준 충족 보장' })
  }
  return s
}