import {
  calculateNutrition,
  type DogInfo,
  type SurveyAnswers,
} from './nutrition.ts'

/**
 * 반사실 시뮬레이션 (Counterfactual / What-if).
 *
 * 발명 명세 모듈 G — Pearl framework 의 do-calculus 응용. 한 변수만
 * "교란(perturb)" 해 새 권고를 계산, 현재 권고와의 차이로 변수별 영향력
 * 을 정량화한다.
 *
 * # 1차 스코프 (D8.1)
 * 단순화된 feedGrams model — RER × activityFactor × stage-modifier.
 * calculateNutrition() 의 전체 로직과는 별개. 추후 D8.x 에서 실제
 * nutrition lib 와 통합. 지금은 직관적인 sensitivity 분석 도구.
 *
 * # 사용 시나리오
 * - 수의사 portal: "BCS 가 6 일 때 권고는?" what-if
 * - 메타학습 ground-truth: "이 변수의 변화 ΔX 가 권고 ΔY 와 얼마나 부합?"
 * - 보호자 UI: "체중이 1kg 늘면 식단이 어떻게 바뀔까요?" 교육
 *
 * # voice-guidelines
 * 결과 라벨에 "예측" 또는 "추정" 명시. "확실히 그렇다" 같은 결정론적
 * 카피 X. 호출처가 표시 시 톤 책임.
 */

export type LifeStage = 'puppy' | 'adult' | 'senior'

export type DogState = {
  weightKg: number
  /** WSAVA 9점 척도. 5 = 이상. */
  bcs: number
  /**
   * 활동 보정계수.
   * 1.6 = 매우 활발 / 1.4 = 활발 / 1.2 = 보통 / 1.0 = 비활동
   */
  activityFactor: number
  lifeStage: LifeStage
  /** 중성화 여부 — neutered 면 -10% MER. */
  neutered: boolean
  /**
   * audit #18: 대형견 puppy 분류용. nutrition.ts lifestage() 가 puppy 분기 시
   * expectedAdultWeight 우선 사용 (소형견 puppy 의 weight 가 적어 medium 으로
   * 잘못 분류되는 케이스 방어). counterfactual 시뮬레이션에서도 같은 매핑 보장.
   */
  expectedAdultWeightKg?: number | null
}

/**
 * [A2 fix] 일일 권장 그램 계산 — 실제 calculateNutrition() wrapping.
 *
 * 이전 (KCAL_PER_GRAM=3.5 고정 + 단순 modifier 식) 은 nutrition.ts 의
 * BCS 9점 정확 factor / 임신·수유 / 신뢰구간 모두 무시. sensitivity 결과가
 * 실 처방과 어긋남 → 발명 핵심 청구항인데 보호자 신뢰 깨짐.
 *
 * 통합 후: DogState → calculateNutrition() 호출 → feedG 그대로 반환.
 * Lifecycle / BCS / neuter / activity 모두 동일 로직 사용.
 */
const KCAL_PER_GRAM = 3.5

export function feedGramsModel(state: DogState): number {
  if (state.weightKg <= 0) return 0

  // activityFactor (숫자) → activityLevel ('low'/'medium'/'high') 매핑.
  // 칼로리 v2 정합: 사다리에서 low·medium 은 동일 계수(BASE — 감산 지배형)라
  // kcal 민감도 축은 사실상 high(+0.1 가산) 경계 통과 여부. 1.3 미만 = low /
  // 1.5 이상 = high / 그 사이 = medium.
  const activityLevel: 'low' | 'medium' | 'high' =
    state.activityFactor < 1.3
      ? 'low'
      : state.activityFactor >= 1.5
        ? 'high'
        : 'medium'

  // lifeStage → ageValue/ageUnit 매핑. nutrition.lifeStage() 가 weight 와
  // age 로 stage 결정하므로, perturbation 의도가 보존되게 stage 명시 강제는
  // age 값 — puppy 6mo / adult 36mo / senior 96mo (대형견 일관 매핑).
  const { ageValue, ageUnit } =
    state.lifeStage === 'puppy'
      ? { ageValue: 6 as const, ageUnit: 'months' as const }
      : state.lifeStage === 'senior'
        ? { ageValue: 10 as const, ageUnit: 'years' as const }
        : { ageValue: 3 as const, ageUnit: 'years' as const }

  // BCS clamp + bcsExact 로 전달 — calculateNutrition 의 9점 정확 factor
  // 사용 (5단계 매핑 보다 정확).
  const bcsExact = Math.max(1, Math.min(9, Math.round(state.bcs))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

  const dogInfo: DogInfo = {
    weight: state.weightKg,
    ageValue,
    ageUnit,
    neutered: state.neutered,
    activityLevel,
    gender: null,
    // audit #18: expectedAdultWeight 전달 — do-calculus 청구항 정합성.
    expectedAdultWeight: state.expectedAdultWeightKg ?? null,
  }
  const surveyAnswers: SurveyAnswers = {
    bodyCondition: 'ideal', // bcsExact 가 우선이라 무시됨
    allergies: [],
    healthConcerns: [],
    bcsExact,
  }

  try {
    const result = calculateNutrition(dogInfo, surveyAnswers)
    return result.feedG
  } catch {
    // 실 calculation 실패 시 단순 fallback.
    //
    // audit #11 정합성 — BCS 1 (응급 refeeding) 은 calculateNutrition 와
    // 동일하게 baseline 유지 (×1.15 곱셈 skip). fallback path 도 같은
    // 보수적 정책 적용 — 호출처가 두 path 결과 차이로 혼란 X.
    const rer = 70 * Math.pow(state.weightKg, 0.75)
    let factor = state.activityFactor
    if (state.bcs >= 7) factor *= 0.85
    else if (state.bcs === 1) {
      // BCS 1 응급 — baseline 유지 (refeeding syndrome 위험)
    } else if (state.bcs <= 3) factor *= 1.15
    if (state.lifeStage === 'puppy') factor *= 1.4
    if (state.lifeStage === 'senior') factor *= 0.9
    if (state.neutered) factor *= 0.9
    return Math.round((rer * factor) / KCAL_PER_GRAM)
  }
}

export type Perturbation =
  | { variable: 'weightKg'; delta: number }
  | { variable: 'bcs'; delta: number }
  | { variable: 'activityFactor'; delta: number }
  | { variable: 'lifeStage'; value: LifeStage }
  | { variable: 'neutered'; value: boolean }

export type CounterfactualOutcome = {
  variable: Perturbation['variable']
  description: string
  current: number
  hypothetical: number
  /** hypothetical - current (그램) */
  delta: number
  /** delta / current (소수). current=0 이면 0. */
  deltaPct: number
}

/**
 * 한 변수만 교란 후 새 권고를 계산. 다른 변수는 모두 동일.
 *
 * Pearl framework do(X = x) — 인과적으로 X 를 강제로 설정하고 결과 관찰.
 */
export function counterfactual(
  baseline: DogState,
  perturbation: Perturbation,
): CounterfactualOutcome {
  const current = feedGramsModel(baseline)
  const next: DogState = { ...baseline }
  let description = ''

  switch (perturbation.variable) {
    case 'weightKg':
      next.weightKg = clampPositive(baseline.weightKg + perturbation.delta)
      description = `체중 ${signed(perturbation.delta, 1)} kg`
      break
    case 'bcs':
      next.bcs = clamp(baseline.bcs + perturbation.delta, 1, 9)
      description = `BCS ${signed(perturbation.delta, 0)}`
      break
    case 'activityFactor':
      next.activityFactor = clampPositive(
        baseline.activityFactor + perturbation.delta,
      )
      description = `활동 보정 ${signed(perturbation.delta, 2)}`
      break
    case 'lifeStage':
      next.lifeStage = perturbation.value
      description = `라이프 스테이지 → ${perturbation.value}`
      break
    case 'neutered':
      next.neutered = perturbation.value
      description = `중성화 → ${perturbation.value ? '예' : '아니오'}`
      break
  }

  const hypothetical = feedGramsModel(next)
  const delta = hypothetical - current
  const deltaPct = current > 0 ? delta / current : 0
  return {
    variable: perturbation.variable,
    description,
    current,
    hypothetical,
    delta,
    deltaPct: Math.round(deltaPct * 100) / 100,
  }
}

/**
 * 변수별 sensitivity — 다수 perturbation 동시 실행 후 |delta| 큰 순 정렬.
 *
 * 기본 perturbation set:
 *  - 체중 ±1kg
 *  - BCS ±1
 *  - 활동 +0.3 / -0.3 (칼로리 v2: low·mid 동일 계수라 ±0.2 로는 high 경계를
 *    못 넘어 delta 0 — 레벨 경계 통과가 보장되는 폭으로 조정)
 *
 * 결과를 수의사 / 보호자가 "가장 영향 큰 변수" 로 인식.
 */
/**
 * 발명 핵심 — counterfactual flag 가드. PCT 출원 전 kill switch.
 * 일반 feedGramsModel/counterfactual 단일 호출은 가드 X (단순 추정).
 * 전체 sensitivityAnalysis (do-calculus 핵심) 만 flag 가드.
 */
function counterfactualFlagOn(): boolean {
  if (process.env.NEXT_PUBLIC_INVENTION_CORE !== 'on') return false
  return process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL !== 'off'
}

export function sensitivityAnalysis(baseline: DogState): CounterfactualOutcome[] {
  if (!counterfactualFlagOn()) return []
  const perts: Perturbation[] = [
    { variable: 'weightKg', delta: 1 },
    { variable: 'weightKg', delta: -1 },
    { variable: 'bcs', delta: 1 },
    { variable: 'bcs', delta: -1 },
    { variable: 'activityFactor', delta: 0.3 },
    { variable: 'activityFactor', delta: -0.3 },
  ]
  const results = perts.map((p) => counterfactual(baseline, p))
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function clampPositive(n: number): number {
  return n < 0 ? 0 : n
}

function signed(n: number, digits: number): string {
  const v = n.toFixed(digits)
  return n >= 0 ? `+${v}` : v
}
