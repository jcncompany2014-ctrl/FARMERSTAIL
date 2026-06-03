/**
 * XL-3 (#12) — 30일 식단 시뮬레이션 (보호자 UI 용).
 *
 * 출원서 모듈 F 의 보호자 친화 버전. lib/counterfactual.ts 의 sensitivity
 * 분석 (do-calculus, 수의사·메타학습 용) 과 달리, 본 모듈은 일반 사용자가
 * "이 식단 바꾸면 30일 후 어떻게 될까?" 를 시각적으로 비교하는 도구.
 *
 * # 모델 (heuristic)
 *  - Δkcal/day = ΣmacroDelta×kcalPerG (단백 4, 지방 9, 탄수 4) × MER / 평균밀도
 *  - 30일 누적 → ΔWeight = ΔkcalSum / 7700 (1kg fat ≈ 7700 kcal)
 *  - ΔBCS = ΔWeight / currentWeight × 5 (9-point scale, linear)
 *  - 운동: 30min/day → MER × 0.10 추가 소모
 *  - 간식: 1회 ≈ 50 kcal
 *
 * # 주의
 *  본 모델은 추정. 견 종·연령·대사 차이로 ±30% 변동.
 *  UI 에 "추정치 (실측과 다를 수 있음)" 명시 필요.
 */

export interface DietSimBaseline {
  /** 일일 권장 칼로리 (kcal) */
  mer: number
  weightKg: number
  /** 현재 BCS 1-9 */
  bcs: number
  /** DM 매크로 % */
  proteinPct: number
  fatPct: number
  carbPct: number
  fiberPct: number
  /** Bristol 1-7 (없으면 4 가정) */
  bristol?: number
}

export interface DietSimScenario {
  id: string
  label: string
  description: string
  proteinDelta?: number
  fatDelta?: number
  carbDelta?: number
  fiberDelta?: number
  /** 일일 간식 변화 (회) */
  snackDelta?: number
  /** 일일 산책 분 변화 */
  walkMinutesDelta?: number
}

export interface DietSimOutcome {
  scenarioId: string
  predictedWeightKg: number
  predictedBcs: number
  predictedBristol: number
  cumulativeKcalDelta: number
  verdict: 'risk' | 'neutral' | 'improvement'
  verdictReason: string
}

/**
 * 단일 시나리오 30일 후 예측.
 */
export function simulateScenario(
  base: DietSimBaseline,
  scenario: DietSimScenario,
): DietSimOutcome {
  const avgKcalPerG =
    (base.proteinPct * 4 + base.fatPct * 9 + base.carbPct * 4) / 100 || 1.45

  const proteinKcalDelta =
    ((scenario.proteinDelta ?? 0) / 100) * base.mer * (4 / avgKcalPerG)
  const fatKcalDelta =
    ((scenario.fatDelta ?? 0) / 100) * base.mer * (9 / avgKcalPerG)
  const carbKcalDelta =
    ((scenario.carbDelta ?? 0) / 100) * base.mer * (4 / avgKcalPerG)
  const snackKcalDelta = (scenario.snackDelta ?? 0) * 50
  const walkKcalBurn = ((scenario.walkMinutesDelta ?? 0) / 30) * base.mer * 0.1

  const dailyKcalDelta =
    proteinKcalDelta +
    fatKcalDelta +
    carbKcalDelta +
    snackKcalDelta -
    walkKcalBurn

  const cumulativeKcalDelta = dailyKcalDelta * 30
  const weightDeltaKg = cumulativeKcalDelta / 7700
  const predictedWeightKg = round1(base.weightKg + weightDeltaKg)
  // base.weightKg <= 0 (잘못된 입력) 가드 — division by zero 회피.
  // 이 경우 BCS 변화 0 으로 fallback. simulate page 가 weight 미입력 강아지
  // 진입 차단해야 정상이지만 lib 자체에서도 방어.
  const bcsDelta =
    base.weightKg > 0 ? (weightDeltaKg / base.weightKg) * 5 : 0
  const predictedBcs = clamp(round1(base.bcs + bcsDelta), 1, 9)

  const baseBristol = base.bristol ?? 4
  const fiberEffect = -(scenario.fiberDelta ?? 0) * 0.15
  const fatEffect = (scenario.fatDelta ?? 0) * 0.1
  const predictedBristol = clamp(
    round1(baseBristol + fiberEffect + fatEffect),
    1,
    7,
  )

  const { verdict, verdictReason } = computeVerdict(base, {
    predictedBcs,
    predictedBristol,
  })

  return {
    scenarioId: scenario.id,
    predictedWeightKg,
    predictedBcs,
    predictedBristol,
    cumulativeKcalDelta: Math.round(cumulativeKcalDelta),
    verdict,
    verdictReason,
  }
}

/**
 * 30일 일별 시계열 — 차트용 (선형 보간).
 */
export function simulateTrajectory(
  base: DietSimBaseline,
  scenario: DietSimScenario,
): Array<{ day: number; weightKg: number; bcs: number }> {
  const outcome = simulateScenario(base, scenario)
  const points: Array<{ day: number; weightKg: number; bcs: number }> = []
  for (let day = 0; day <= 30; day += 5) {
    const t = day / 30
    points.push({
      day,
      weightKg: round1(
        base.weightKg + t * (outcome.predictedWeightKg - base.weightKg),
      ),
      bcs: round1(base.bcs + t * (outcome.predictedBcs - base.bcs)),
    })
  }
  return points
}

/**
 * 기본 4 시나리오 (UI 첫 진입).
 */
export function defaultDietScenarios(): DietSimScenario[] {
  return [
    {
      id: 'baseline',
      label: '현재 식단 그대로',
      description: '변경 없음. 비교 기준선.',
    },
    {
      id: 'protein_up',
      label: '단백질 +5%',
      description: '곡물을 줄이고 닭가슴살·연어 비중 증가.',
      proteinDelta: 5,
      carbDelta: -5,
    },
    {
      id: 'fat_down',
      label: '지방 -3% · 간식 -1회',
      description: '체중 감량 목표. 살코기 위주.',
      fatDelta: -3,
      snackDelta: -1,
    },
    {
      id: 'walk_up',
      label: '산책 +30분/일',
      description: '식단 동일, 운동만 추가.',
      walkMinutesDelta: 30,
    },
  ]
}

// ─── helpers ───

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function computeVerdict(
  base: DietSimBaseline,
  predicted: { predictedBcs: number; predictedBristol: number },
): { verdict: 'risk' | 'neutral' | 'improvement'; verdictReason: string } {
  const idealBcsBand = base.bcs >= 4 && base.bcs <= 6
  const movingTowardIdeal =
    !idealBcsBand &&
    Math.abs(predicted.predictedBcs - 5) < Math.abs(base.bcs - 5)

  if (predicted.predictedBcs >= 7) {
    return {
      verdict: 'risk',
      verdictReason: '예상 BCS 7 이상 — 과체중 위험.',
    }
  }
  if (predicted.predictedBcs <= 3) {
    return {
      verdict: 'risk',
      verdictReason: '예상 BCS 3 이하 — 저체중 위험.',
    }
  }
  if (predicted.predictedBristol >= 6) {
    return {
      verdict: 'risk',
      verdictReason: '예상 Bristol 6 이상 — 변 무름 위험.',
    }
  }
  if (predicted.predictedBristol <= 2) {
    return {
      verdict: 'risk',
      verdictReason: '예상 Bristol 2 이하 — 변비 위험.',
    }
  }
  if (movingTowardIdeal) {
    return {
      verdict: 'improvement',
      verdictReason: `BCS 가 이상 범위 (5) 쪽으로 이동 — ${base.bcs.toFixed(1)} → ${predicted.predictedBcs.toFixed(1)}.`,
    }
  }
  return {
    verdict: 'neutral',
    verdictReason: '큰 변화 없음. 안정 상태 유지.',
  }
}
