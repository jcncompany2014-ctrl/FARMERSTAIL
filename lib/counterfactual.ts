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
}

/**
 * 1차 단순 모델로 일일 권장 그램 계산.
 *
 * RER = 70 × W^0.75
 * MER = RER × activityFactor × stage modifier × BCS modifier × neuter modifier
 * feedG = MER / kcalPerGram   (자체 화식 기준 ≈ 3.5 kcal/g)
 *
 * 자체 사료 정확도 측면에서 kcalPerGram 은 사료 종류별 상이. 여기서는 평균.
 */
const KCAL_PER_GRAM = 3.5

export function feedGramsModel(state: DogState): number {
  if (state.weightKg <= 0) return 0
  const rer = 70 * Math.pow(state.weightKg, 0.75)
  let factor = state.activityFactor
  // BCS 보정 — 7+ 감량 / 3- 증량
  if (state.bcs >= 7) factor *= 0.85
  if (state.bcs <= 3) factor *= 1.15
  // 라이프 스테이지
  if (state.lifeStage === 'puppy') factor *= 1.4
  if (state.lifeStage === 'senior') factor *= 0.9
  // 중성화 — MER 약 10% ↓
  if (state.neutered) factor *= 0.9
  const mer = rer * factor
  return Math.round(mer / KCAL_PER_GRAM)
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
 *  - 활동 +0.2 / -0.2
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
    { variable: 'activityFactor', delta: 0.2 },
    { variable: 'activityFactor', delta: -0.2 },
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
