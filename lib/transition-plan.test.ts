/**
 * transition-plan — 화식 전환 스케줄.
 *
 * 이 표는 **살아 있는 동물이 먹을 양**이다. AI 에 맡기지 않고 순수 함수로 두는
 * 이유가 이것이고, 그렇다면 규칙이 깨지지 않는 걸 테스트가 지켜야 한다.
 *
 * 핵심 회귀 방지:
 *  1. 비율은 항상 100% 로 떨어진다(기존 + 화식). 굶기거나 두 배로 먹이면 안 된다.
 *  2. 화식 비중은 **절대 뒤로 가지 않는다**(단조 증가).
 *  3. 마지막 날은 반드시 화식 100%.
 *  4. 첫 끼부터 100% 인 전략은 없다 — 어떤 전략이든 단계가 있다.
 *  5. 화식이 처음/장 예민(conservative)이 가장 길다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTransitionPlan,
  groupTransitionPhases,
} from './transition-plan.ts'
import type { TransitionStrategy } from './personalization/types.ts'

const ALL: TransitionStrategy[] = ['conservative', 'gradual', 'aggressive']
/** 제품의 화식 비율 티어 — 곁들임 / 반반 / 완전. */
const TARGETS = [30, 60, 100]

describe('buildTransitionPlan — 모든 전략의 불변식', () => {
  it('기존 + 화식 = 항상 100% (굶기거나 두 배로 먹이지 않는다)', () => {
    for (const s of ALL) for (const t of TARGETS) {
      for (const step of buildTransitionPlan(s, t).steps) {
        assert.equal(
          step.oldPct + step.newPct,
          100,
          `${s} ${step.day}일차: ${step.oldPct}+${step.newPct}`,
        )
      }
    }
  })

  it('화식 비중은 절대 뒤로 가지 않는다 (단조 증가)', () => {
    for (const s of ALL) for (const t of TARGETS) {
      const steps = buildTransitionPlan(s, t).steps
      for (let i = 1; i < steps.length; i++) {
        assert.ok(
          steps[i]!.newPct >= steps[i - 1]!.newPct,
          `${s}: ${steps[i - 1]!.newPct}% → ${steps[i]!.newPct}% 로 후퇴`,
        )
      }
    }
  })

  it('마지막 날은 반드시 **고른 비율** 에 정확히 도착 (100% 가 아니다)', () => {
    for (const s of ALL) for (const t of TARGETS) {
      const steps = buildTransitionPlan(s, t).steps
      assert.equal(steps[steps.length - 1]!.newPct, t, `${s}/${t}`)
    }
  })

  it('고른 비율을 절대 넘지 않는다 — 곁들임 30% 를 고른 사람에게 100% 를 먹이면 안 된다', () => {
    for (const s of ALL) for (const t of TARGETS) {
      for (const step of buildTransitionPlan(s, t).steps) {
        assert.ok(step.newPct <= t, `${s}/${t}: ${step.newPct}% 로 초과`)
      }
    }
  })

  it('비율은 5% 단위 — 보호자가 계량할 수 있어야 한다', () => {
    for (const s of ALL) for (const t of TARGETS) {
      for (const step of buildTransitionPlan(s, t).steps) {
        assert.equal(step.newPct % 5, 0, `${s}/${t}: ${step.newPct}%`)
      }
    }
  })

  it('첫 끼부터 목표치인 전략은 없다 — 어떤 전략이든 단계가 있다', () => {
    for (const s of ALL) for (const t of TARGETS) {
      const steps = buildTransitionPlan(s, t).steps
      assert.ok(steps[0]!.newPct < t, `${s}/${t} 는 1일차부터 목표치`)
      assert.ok(steps.length >= 3, `${s} 는 단계가 ${steps.length}일뿐`)
    }
  })

  it('day 는 1부터 빈틈없이 이어진다', () => {
    for (const s of ALL) {
      const steps = buildTransitionPlan(s, 100).steps
      steps.forEach((step, i) => assert.equal(step.day, i + 1, s))
    }
  })
})

describe('buildTransitionPlan — 전략별 속도', () => {
  it('화식 처음/장 예민(conservative)이 가장 길다', () => {
    const c = buildTransitionPlan('conservative', 100).totalDays
    const g = buildTransitionPlan('gradual', 100).totalDays
    const a = buildTransitionPlan('aggressive', 100).totalDays
    assert.ok(c > g, `conservative(${c}) > gradual(${g})`)
    assert.ok(g > a, `gradual(${g}) > aggressive(${a})`)
  })

  it('conservative = 2주 · gradual = 1주 · aggressive = 3일', () => {
    assert.equal(buildTransitionPlan('conservative', 100).totalDays, 14)
    assert.equal(buildTransitionPlan('gradual', 100).totalDays, 7)
    assert.equal(buildTransitionPlan('aggressive', 100).totalDays, 3)
  })

  it('전략마다 문구가 다르다 (같은 말을 돌려쓰지 않는다)', () => {
    const heads = ALL.map((s) => buildTransitionPlan(s, 100).headline)
    assert.equal(new Set(heads).size, ALL.length)
  })
})

describe('groupTransitionPhases — 표로 묶기', () => {
  it('14일을 4단계로 묶는다 (14줄을 보여주면 아무도 안 읽는다)', () => {
    const phases = groupTransitionPhases(buildTransitionPlan('conservative', 100))
    assert.equal(phases.length, 4)
    assert.deepEqual(
      phases.map((p) => p.newPct),
      [25, 50, 75, 100],
    )
  })

  it('묶어도 날짜가 빈틈없이 이어진다', () => {
    for (const s of ALL) for (const t of TARGETS) {
      const plan = buildTransitionPlan(s, t)
      const phases = groupTransitionPhases(plan)
      assert.equal(phases[0]!.fromDay, 1)
      assert.equal(phases[phases.length - 1]!.toDay, plan.totalDays)
      for (let i = 1; i < phases.length; i++) {
        assert.equal(phases[i]!.fromDay, phases[i - 1]!.toDay + 1, s)
      }
    }
  })
})
