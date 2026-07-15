/**
 * bcs-consistency 단위 테스트 — 체중↔체형 모순 검증.
 *
 * 사장님이 짚은 케이스: "살이 빠졌는데 체형이 더 뚱뚱해질 수는 없는 거잖아?"
 *
 * 핵심 회귀 방지:
 *  1. 체중↓ + BCS↑ → 모순으로 잡는다.
 *  2. 체중↑ + BCS↓ → 모순. 단 성장기(자견)는 정상이라 예외.
 *  3. 측정 노이즈(3% 미만)로 오탐하지 않는다.
 *  4. 비교 대상(이전 분석)이 없으면 조용히 통과.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectBcsWeightConflict } from './bcs-consistency.ts'

function detect(over: Record<string, unknown> = {}) {
  return detectBcsWeightConflict({
    dogName: '푸린',
    prevBcs: 5,
    prevWeightKg: 5.0,
    currentBcs: 5,
    currentWeightKg: 5.0,
    ...over,
  })
}

describe('detectBcsWeightConflict — 체중↓ + 체형↑ (사장님 케이스)', () => {
  it('5.0 → 4.5kg 인데 BCS 5 → 7 이면 모순', () => {
    const r = detect({ currentWeightKg: 4.5, currentBcs: 7 })
    assert.ok(r)
    assert.equal(r!.kind, 'weight_down_bcs_up')
    assert.match(r!.detail, /5\.0 → 4\.5kg/)
    assert.match(r!.detail, /줄었는데/)
    assert.match(r!.flagLabel, /수의 상담 권장/)
  })

  it('BCS 1점 차이도 잡는다', () => {
    const r = detect({ currentWeightKg: 4.5, currentBcs: 6 })
    assert.equal(r?.kind, 'weight_down_bcs_up')
  })

  it('체중은 줄고 BCS 도 내려가면 정상 → null', () => {
    assert.equal(detect({ currentWeightKg: 4.5, currentBcs: 4 }), null)
  })

  it('체중은 줄고 BCS 그대로면 정상 → null', () => {
    assert.equal(detect({ currentWeightKg: 4.5, currentBcs: 5 }), null)
  })
})

describe('detectBcsWeightConflict — 체중↑ + 체형↓', () => {
  it('성견이면 모순', () => {
    const r = detect({ currentWeightKg: 5.5, currentBcs: 3, lifeStage: 'adult' })
    assert.equal(r?.kind, 'weight_up_bcs_down')
    assert.match(r!.detail, /늘었는데/)
  })

  it('성장기(자견)는 정상 → null (키 크면서 날씬해짐)', () => {
    assert.equal(
      detect({ currentWeightKg: 5.5, currentBcs: 3, lifeStage: 'puppy' }),
      null,
    )
  })

  it('노령견은 예외 아님 — 모순으로 잡는다', () => {
    const r = detect({ currentWeightKg: 5.5, currentBcs: 3, lifeStage: 'senior' })
    assert.equal(r?.kind, 'weight_up_bcs_down')
  })

  it('이름이 겹쳐 나오지 않는다', () => {
    const r = detect({ currentWeightKg: 5.5, currentBcs: 3, lifeStage: 'adult' })
    assert.ok(!r!.action.includes('푸린이푸린'), r!.action)
  })
})

describe('detectBcsWeightConflict — 측정 노이즈 방어', () => {
  it('체중 변화 3% 미만이면 BCS 가 튀어도 오탐하지 않는다', () => {
    // 5.0 → 4.9kg = -2% (저울 오차 범위)
    assert.equal(detect({ currentWeightKg: 4.9, currentBcs: 7 }), null)
  })

  it('3% 넘어도 절대량이 150g 미만이면 오탐하지 않는다 (토이견)', () => {
    // 1.0 → 0.95kg = -5% 지만 50g — 역산 오차 범위
    const r = detect({
      prevWeightKg: 1.0,
      currentWeightKg: 0.95,
      currentBcs: 7,
    })
    assert.equal(r, null)
  })

  it('토이견이라도 변화가 충분히 크면 잡는다', () => {
    const r = detect({ prevWeightKg: 3.0, currentWeightKg: 2.7, currentBcs: 7 })
    assert.equal(r?.kind, 'weight_down_bcs_up')
  })
})

describe('detectBcsWeightConflict — 비교 대상이 없을 때', () => {
  it('이전 분석 BCS 가 없으면 null', () => {
    assert.equal(detect({ prevBcs: null, currentWeightKg: 4.5, currentBcs: 7 }), null)
  })

  it('이번 BCS 가 아직 역산 안 됐으면 null (3문항 미완성)', () => {
    assert.equal(detect({ currentBcs: null, currentWeightKg: 4.5 }), null)
  })

  it('이전 체중이 없으면 null', () => {
    assert.equal(
      detect({ prevWeightKg: null, currentWeightKg: 4.5, currentBcs: 7 }),
      null,
    )
  })

  it('체중이 0/음수/NaN 이면 null (0 나눗셈 방어)', () => {
    assert.equal(detect({ prevWeightKg: 0, currentWeightKg: 4.5, currentBcs: 7 }), null)
    assert.equal(detect({ currentWeightKg: -1, currentBcs: 7 }), null)
    assert.equal(
      detect({ prevWeightKg: Number.NaN, currentWeightKg: 4.5, currentBcs: 7 }),
      null,
    )
  })
})
