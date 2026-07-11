import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decideReweigh, goalFromBcs } from './reweigh.ts'

describe('goalFromBcs — BCS → 피드백 목표', () => {
  it('BCS 7 → lose, BCS 3 → gain, BCS 5/미입력 → maintain', () => {
    assert.equal(goalFromBcs(7), 'lose')
    assert.equal(goalFromBcs(3), 'gain')
    assert.equal(goalFromBcs(5), 'maintain')
    assert.equal(goalFromBcs(null), 'maintain')
  })
})

describe('decideReweigh — M10 판정', () => {
  it('유지 목표 + 4주간 +6% 증가 → DER −10% 조정', () => {
    const d = decideReweigh({
      prevDer: 550,
      baselineWeightKg: 5.0,
      latestWeightKg: 5.3,
      days: 28,
      bcsScore: 5,
    })
    assert.equal(d.action, 'adjust')
    assert.equal(d.newDer, 495) // 550 × 0.9
    assert.equal(d.weightDeltaPct, 6)
  })

  it('유지 목표 + ±2% 이내 → hold (유지 양호)', () => {
    const d = decideReweigh({
      prevDer: 550,
      baselineWeightKg: 5.0,
      latestWeightKg: 5.08,
      days: 28,
      bcsScore: 5,
    })
    assert.equal(d.action, 'hold')
    assert.equal(d.newDer, 550)
  })

  it('감량 목표(BCS 7) + 정체(0.2%/주) → −10% 단계 인하', () => {
    const d = decideReweigh({
      prevDer: 300,
      baselineWeightKg: 8.0,
      latestWeightKg: 7.99, // 4주간 −0.125% ≈ 정체
      days: 28,
      bcsScore: 7,
    })
    assert.equal(d.goal, 'lose')
    assert.equal(d.action, 'adjust')
    assert.equal(d.newDer, 270)
  })

  it('감량 목표 + 과속(주 3%) → +10% (과속 방지)', () => {
    const d = decideReweigh({
      prevDer: 300,
      baselineWeightKg: 8.0,
      latestWeightKg: 7.52, // 2주간 −6% = 주 3%
      days: 14,
      bcsScore: 7,
    })
    assert.equal(d.action, 'adjust')
    assert.equal(d.newDer, 330)
  })

  it('증량 목표(BCS 3) + 정체 → +10%', () => {
    const d = decideReweigh({
      prevDer: 400,
      baselineWeightKg: 4.0,
      latestWeightKg: 3.98,
      days: 21,
      bcsScore: 3,
    })
    assert.equal(d.goal, 'gain')
    assert.equal(d.newDer, 440)
  })

  it('게이트: 14일 미만 간격 → insufficient (판정 보류)', () => {
    const d = decideReweigh({
      prevDer: 550,
      baselineWeightKg: 5.0,
      latestWeightKg: 5.5,
      days: 10,
      bcsScore: 5,
    })
    assert.equal(d.action, 'insufficient')
    assert.equal(d.newDer, 550)
  })

  it('게이트: prevDer/체중 비정상 → insufficient', () => {
    assert.equal(
      decideReweigh({ prevDer: 0, baselineWeightKg: 5, latestWeightKg: 5.3, days: 28 }).action,
      'insufficient',
    )
    assert.equal(
      decideReweigh({ prevDer: 500, baselineWeightKg: 0, latestWeightKg: 5.3, days: 28 }).action,
      'insufficient',
    )
  })
})
