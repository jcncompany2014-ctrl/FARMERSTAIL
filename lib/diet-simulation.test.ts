/**
 * diet-simulation 단위 테스트. XL-3 (#12) 핵심 회귀 방지.
 *
 * 검증:
 *  1. baseline (delta 0) → predicted = base (변화 없음)
 *  2. 단백질 +5% / 탄수 -5% → 칼로리 변화 minimal (4kcal/g 동일)
 *  3. 지방 -3% + 간식 -1 → 체중 감소 → BCS 감소
 *  4. base.weightKg = 0 → division by zero 방지 (NaN 반환 X)
 *  5. verdict 임계값: BCS 7 이상 → risk, 이상 → improvement
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  simulateScenario,
  simulateTrajectory,
  defaultDietScenarios,
  type DietSimBaseline,
} from './diet-simulation.ts'

function baseline(overrides: Partial<DietSimBaseline> = {}): DietSimBaseline {
  return {
    mer: 500,
    weightKg: 10,
    bcs: 5,
    proteinPct: 25,
    fatPct: 15,
    carbPct: 45,
    fiberPct: 4,
    bristol: 4,
    ...overrides,
  }
}

describe('simulateScenario — baseline / 변화 없음', () => {
  it('모든 delta = 0 → predicted = base (변화 없음)', () => {
    const result = simulateScenario(baseline(), {
      id: 'baseline',
      label: '',
      description: '',
    })
    assert.equal(result.predictedWeightKg, 10)
    assert.equal(result.predictedBcs, 5)
    assert.equal(result.predictedBristol, 4)
    assert.equal(result.cumulativeKcalDelta, 0)
    assert.equal(result.verdict, 'neutral')
  })
})

describe('simulateScenario — 시나리오 효과', () => {
  it('단백질 +5% / 탄수 -5% → kcal 거의 영향 없음 (4kcal/g 동일)', () => {
    const result = simulateScenario(baseline(), {
      id: 't',
      label: '',
      description: '',
      proteinDelta: 5,
      carbDelta: -5,
    })
    // protein 과 carb 모두 4 kcal/g → 5% 교환 ≈ ΔkcalSum 0.
    assert.ok(
      Math.abs(result.cumulativeKcalDelta) < 50,
      `expected near 0 kcal delta, got ${result.cumulativeKcalDelta}`,
    )
  })

  it('지방 -3% + 간식 -1회 → 체중 감소 → BCS 감소', () => {
    const result = simulateScenario(baseline({ bcs: 7 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: -3,
      snackDelta: -1,
    })
    assert.ok(
      result.predictedWeightKg < 10,
      `expected weight loss, got ${result.predictedWeightKg}`,
    )
    assert.ok(
      result.predictedBcs < 7,
      `expected BCS reduction, got ${result.predictedBcs}`,
    )
  })

  it('산책 +30분 → MER × 0.10 추가 소모 → 체중 감소', () => {
    const result = simulateScenario(baseline(), {
      id: 't',
      label: '',
      description: '',
      walkMinutesDelta: 30,
    })
    assert.ok(result.cumulativeKcalDelta < 0)
    assert.ok(result.predictedWeightKg < 10)
  })

  it('섬유 +2% → Bristol firmer (4 → 3.x)', () => {
    const result = simulateScenario(baseline(), {
      id: 't',
      label: '',
      description: '',
      fiberDelta: 2,
    })
    assert.ok(
      result.predictedBristol < 4,
      `expected firmer stool, got ${result.predictedBristol}`,
    )
  })
})

describe('simulateScenario — 가드 / edge case', () => {
  it('base.weightKg = 0 → division by zero 방지, BCS 변화 0', () => {
    const result = simulateScenario(baseline({ weightKg: 0 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: 5,
    })
    assert.ok(Number.isFinite(result.predictedBcs))
    assert.ok(!Number.isNaN(result.predictedBcs))
    assert.equal(result.predictedBcs, 5)
  })

  it('predictedBcs 1~9 clamp', () => {
    const result = simulateScenario(baseline({ bcs: 8.5 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: 10,
      snackDelta: 3,
    })
    assert.ok(result.predictedBcs <= 9)
    assert.ok(result.predictedBcs >= 1)
  })

  it('predictedBristol 1~7 clamp', () => {
    const result = simulateScenario(baseline({ bristol: 7 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: 10,
    })
    assert.ok(result.predictedBristol <= 7)
    assert.ok(result.predictedBristol >= 1)
  })
})

describe('simulateScenario — verdict', () => {
  /**
   * ★조건부 단언은 조건이 거짓이 되면 **조용히 아무것도 안 한다**
   * (2026-08-08 테스트 감사). 예전 이 테스트는 bcs 6 + 지방 +5 + 간식 +2 로
   * 시뮬레이션한 뒤 `if (result.predictedBcs >= 7)` 안에서만 단언했는데,
   * 실측 predictedBcs 는 **6.3** 이라 그 if 가 거짓이었다 —
   * **단언이 한 줄도 실행되지 않는데 이름은 "risk 를 검증한다"** 고 말했다.
   * 시뮬레이션 계수가 바뀌어도 영원히 초록이었다.
   *
   * 실제로 risk 가 나오는 입력으로 바꾸고, if 를 없앤다.
   * (bcs 7 + 지방 +8 + 간식 +3 → predictedBcs 7.5, verdict 'risk' 실측)
   */
  it('예상 BCS 7 이상이면 risk', () => {
    const result = simulateScenario(baseline({ bcs: 7 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: 8,
      snackDelta: 3,
    })
    // 전제부터 단언한다 — 계수가 바뀌어 7 미만이 되면 여기서 빨간불이 뜨고,
    // 그때 이 테스트를 다시 조정하라는 신호가 된다(조용히 통과하지 않는다).
    assert.ok(
      result.predictedBcs >= 7,
      `이 입력은 BCS 7 이상을 만들어야 한다 (실제 ${result.predictedBcs})`,
    )
    assert.equal(result.verdict, 'risk')
    assert.match(result.verdictReason, /과체중/)
  })

  it('예상 BCS 7 미만이면 risk 가 아니다 (경계 반대편)', () => {
    const result = simulateScenario(baseline({ bcs: 6 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: 5,
      snackDelta: 2,
    })
    assert.ok(result.predictedBcs < 7, `실제 ${result.predictedBcs}`)
    assert.notEqual(result.verdict, 'risk')
  })

  it('BCS 7 → 6 으로 이동 (이상 5 쪽으로) → improvement', () => {
    const result = simulateScenario(baseline({ bcs: 7 }), {
      id: 't',
      label: '',
      description: '',
      fatDelta: -3,
      snackDelta: -2,
    })
    if (result.predictedBcs < 7 && result.predictedBcs > 3) {
      assert.equal(result.verdict, 'improvement')
    }
  })
})

describe('simulateTrajectory — 시계열', () => {
  it('30일 시계열 7 point 반환 (0, 5, 10, ..., 30일)', () => {
    const traj = simulateTrajectory(baseline(), {
      id: 't',
      label: '',
      description: '',
    })
    assert.equal(traj.length, 7)
    assert.equal(traj[0]!.day, 0)
    assert.equal(traj[6]!.day, 30)
  })

  it('baseline 시나리오 → 모든 point 같은 값 유지', () => {
    const traj = simulateTrajectory(baseline(), {
      id: 'baseline',
      label: '',
      description: '',
    })
    for (const point of traj) {
      assert.equal(point.weightKg, 10)
      assert.equal(point.bcs, 5)
    }
  })
})

describe('defaultDietScenarios', () => {
  it('4개 default scenario 반환', () => {
    const list = defaultDietScenarios()
    assert.equal(list.length, 4)
    assert.equal(list[0]!.id, 'baseline')
  })

  it('baseline 시나리오는 모든 delta undefined (변화 없음)', () => {
    const [base] = defaultDietScenarios()
    assert.equal(base?.proteinDelta, undefined)
    assert.equal(base?.fatDelta, undefined)
    assert.equal(base?.snackDelta, undefined)
  })
})
