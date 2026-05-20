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

/**
 * 화식 라인 평균 에너지 밀도 (kcal/g).
 *
 * basic 2.15 / weight 1.75 / skin 2.25 / premium 1.95 / joint 2.0 → 평균 2.02.
 * audit 3-15: 이전엔 calculateNutrition return 안에 2.0 하드코드 → 라인 mix
 * 비율이 바뀌어도 feedG 재계산이 안 됨. 상수로 분리해 추후
 * algorithm_food_lines.energy_density_kcal_per_g 의 가중평균으로 동기화 가능.
 */
export const AVG_ENERGY_DENSITY_KCAL_PER_G = 2.02

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
}

export type DogInfo = {
  weight: number
  ageValue: number
  ageUnit: 'years' | 'months'
  neutered: boolean
  activityLevel: 'low' | 'medium' | 'high'
  /** 임신/수유 적용 게이트 — 'female' 만 pregnancyStatus 반영. */
  gender?: 'male' | 'female' | null
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

export function calculateNutrition(dog: DogInfo, answers: SurveyAnswers): NutritionResult {
  // weight 가드 — 0/음수/비정상 입력 시 NaN/Infinity 폭주 차단.
  // 강아지 0.5kg ~ 100kg 합리적 범위로 clamp. 0 이면 RER=0 → MER=0 → 분석
  // 의미 없음. 0.5kg 최소로 가정 (소형견 신생아 ~250g, 분양 가능 최소).
  const w = Math.max(0.5, Math.min(100, dog.weight || 0.5))
  const RER = computeRer(w)
  const stage = lifeStage(dog)

  // BCS — 정확 입력(v2) 우선, 없으면 5단계 매핑
  const bcs = answers.bcsExact
    ? bcsScoreExact(answers.bcsExact)
    : bcsScore(answers.bodyCondition)

  let factor = 1.6
  const riskFlags: string[] = []
  const citations = new Set<string>(['nrc2006', 'aafco2024', 'fediaf2021'])
  let vetConsult = false

  // audit #10: 거대견 (50kg+) — metabolism rate 가 표준 NRC 공식보다 낮을 수
  // 있어 표준 RER 사용 시 과식 위험. activityLevel='low' 권장 + 수의사 상담
  // flag. 정확한 보정은 임상 측정 (DEXA / indirect calorimetry) 필요.
  if (w >= 50) {
    riskFlags.push('GIANT_BREED')
    vetConsult = true
  }

  // 생애주기 / 활동량 기반 base factor.
  //
  // # 변경 이력 (Tier S F2-1, 2026-05-20)
  // FEDIAF Nutritional Guidelines 2024 Annex 7.2 명시 매핑 (참고):
  //   - 저활동(<1h/day low-impact)     : 95 × BW^0.75 = RER × 1.36
  //   - 평균활동(1-3h/day low-impact)   : 110 × BW^0.75 = RER × 1.57
  //   - 활발(1-3h/day high-impact)      : 125 × BW^0.75 = RER × 1.79
  //
  // 본 코드는 NRC 2006 권장 factor 와 FEDIAF 2024 의 중간점 채택:
  //   - low 1.2 (NRC 보수치, 중성화·노령 견 비만 예방 우선)
  //   - medium 1.57 (FEDIAF 110 정확 정렬)
  //   - high 1.8 (NRC 1.8 ≈ FEDIAF 125 거의 동일, NRC 유지)
  //   - senior 1.2 (NRC 보수치)
  //
  // medium 만 FEDIAF 명시 정렬한 이유: v4.0 보고서가 4kg 평균 활동견 311 kcal
  // 인용 (= 110 × BW^0.75 정확). low/high/senior 는 NRC 보수치가 비만 예방
  // 측면에서 더 안전 + 기존 테스트 일관.
  if (stage === 'puppy') {
    const m = ageMonths(dog)
    if (m < 4) factor = 3.0
    else if (m < 8) factor = 2.5
    else factor = 2.0
  } else if (stage === 'senior') {
    factor = 1.2 // NRC 보수치 — senior 비만·관절 부담 예방
  } else {
    if (dog.activityLevel === 'low') factor = 1.2        // NRC 보수치
    else if (dog.activityLevel === 'high') factor = 1.8  // NRC ≈ FEDIAF 125
    else factor = 1.57                                    // FEDIAF 110 (medium)
  }

  // BCS 보정 — v2 의 정확 9점 factor 우선.
  //
  // # audit #11 v2 — BCS 1 응급 케이스 factor 보수화
  // bcsMerFactor 가 1-2 모두 1.20 리턴하지만 BCS 1 은 refeeding syndrome
  // 위험이라 +20% 칼로리 즉시 적용 X. factor *= 1.0 으로 baseline 유지 +
  // 사용자 chip 으로 단계적 증량 안내 (Day 1-3 25%, Day 4-7 50%, Day 8+ 100%).
  // 시스템은 초기 baseline 제공, 보호자가 수의사 지도 하에 분할 적용.
  if (answers.bcsExact) {
    if (answers.bcsExact === 1) {
      // 응급 — bcsMerFactor 1.20 곱하지 않음. baseline 유지.
      // factor *= 1.0 (no-op, 의도 명시)
    } else {
      factor *= bcsMerFactor(answers.bcsExact)
    }
    citations.add('wsava')
    if (answers.bcsExact >= 8) {
      riskFlags.push('SEVERE_OBESITY')
      vetConsult = true
    } else if (answers.bcsExact >= 7) {
      riskFlags.push('OVERWEIGHT')
    } else if (answers.bcsExact === 1) {
      // factor 는 위에서 baseline 유지 (×1.20 skip).
      riskFlags.push('SEVERE_UNDERWEIGHT')
      riskFlags.push('REFEEDING_RISK')
      vetConsult = true
    } else if (answers.bcsExact === 2) {
      riskFlags.push('SEVERE_UNDERWEIGHT')
      vetConsult = true
    } else if (answers.bcsExact <= 3) {
      riskFlags.push('UNDERWEIGHT')
    }
  } else {
    // 레거시 5단계 — bcsScore() 가 1/3/5/7/9 점만 반환. 9-tier bcsMerFactor
    // 와 정합 (audit fix v1.6.1):
    //   skinny (1): × 1.20  →  obese (9): × 0.75
    factor *= bcsMerFactor(bcs.score as BcsKey)
  }

  // audit 2-14: 중성화 ×0.9 보정은 성견/노령견 한정 (NRC 2006 §11).
  // 자견(puppy)은 성장 호르몬 활성 + 골격 발달 단계라 중성화에 따른 BMR
  // 감소가 미미함. 자견에 0.9 곱하면 underfeed → 발달 저해 위험.
  // 임신/수유견은 아래에서 factor 가 REPLACE 되므로 여기 분기 무관.
  if (dog.neutered && stage !== 'puppy') factor *= 0.9

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
    // feedG — 화식 5종 가중평균 에너지 밀도. SSOT 는 algorithm_food_lines.
    // 이전엔 2.0 kcal/g 하드코드 → 라인 mix 의 실제 평균과 ±15% 어긋남.
    // audit 3-15: AVG_ENERGY_DENSITY_KCAL_PER_G 상수로 추출. 추후 algorithm_food_lines
    // SELECT AVG(energy_density_kcal_per_g) FROM 메타데이터 동기화 가능.
    // basic 2.15 / weight 1.75 / skin 2.25 / premium 1.95 / joint 2.0 평균 = 2.02.
    feedG: Math.round(MER / AVG_ENERGY_DENSITY_KCAL_PER_G),
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
    s.push({ emoji: '🧬', name: '아연 (Zinc)', desc: '피부 세포 재생 촉진' })
  }
  if (concerns.includes('관절')) {
    s.push({ emoji: '🦴', name: '글루코사민 + 콘드로이틴', desc: '연골 보호, 관절 윤활' })
    s.push({ emoji: '🌿', name: '초록입홍합', desc: '천연 항염, 관절 통증 완화' })
  }
  if (concerns.includes('소화')) {
    s.push({ emoji: '🦠', name: '프로바이오틱스', desc: '장내 유익균 증식' })
    s.push({ emoji: '🎃', name: '식이섬유 보충', desc: '장 운동 촉진, 변 상태 개선' })
  }
  if (concerns.includes('체중')) {
    s.push({ emoji: '🔥', name: 'L-카르니틴', desc: '지방 산화 촉진' })
  }
  if (concerns.includes('신장')) {
    s.push({ emoji: '💧', name: '수분 보충 강화', desc: '저인 식이와 충분한 수분' })
    s.push({ emoji: '🌱', name: '오메가-3 (EPA)', desc: '신장 염증 억제' })
  }
  if (concerns.includes('치아')) {
    s.push({ emoji: '🦷', name: '치석 관리 효소', desc: '치태 분해 효소' })
  }
  if (s.length === 0) {
    s.push({ emoji: '✅', name: '기본 종합비타민/미네랄', desc: 'AAFCO 기준 충족 보장' })
  }
  return s
}