import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  counterfactual,
  feedGramsModel,
  sensitivityAnalysis,
  type DogState,
} from './counterfactual.ts'

// counterfactual flag default OFF → sensitivityAnalysis 가 빈 array 반환.
// 테스트 전체에서 ON 으로 강제.
before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL
})

const base: DogState = {
  weightKg: 5,
  bcs: 5,
  activityFactor: 1.2,
  lifeStage: 'adult',
  neutered: false,
}

describe('feedGramsModel', () => {
  it('5kg 성견, 활동 1.2, BCS 5 → 합리적 그램 (60~200g)', () => {
    const g = feedGramsModel(base)
    assert.ok(g >= 60 && g <= 200, `g=${g}`)
  })

  it('체중 0 → 0g', () => {
    assert.equal(feedGramsModel({ ...base, weightKg: 0 }), 0)
  })

  it('puppy 는 adult 보다 grams 큼', () => {
    const adult = feedGramsModel(base)
    const puppy = feedGramsModel({ ...base, lifeStage: 'puppy' })
    assert.ok(puppy > adult)
  })

  it('senior 는 adult 보다 grams 작음', () => {
    const adult = feedGramsModel(base)
    const senior = feedGramsModel({ ...base, lifeStage: 'senior' })
    assert.ok(senior < adult)
  })

  it('neutered 는 ~10% 감소', () => {
    const intact = feedGramsModel(base)
    const fixed = feedGramsModel({ ...base, neutered: true })
    assert.ok(fixed < intact)
    assert.ok(fixed / intact > 0.85 && fixed / intact < 0.95)
  })

  it('BCS 7 (과체중) 은 BCS 5 보다 grams 작음', () => {
    const ideal = feedGramsModel(base)
    const heavy = feedGramsModel({ ...base, bcs: 7 })
    assert.ok(heavy < ideal)
  })

  it('BCS 3 (저체중) 은 BCS 5 보다 grams 큼', () => {
    const ideal = feedGramsModel(base)
    const lean = feedGramsModel({ ...base, bcs: 3 })
    assert.ok(lean > ideal)
  })
})

describe('counterfactual', () => {
  it('체중 +1kg → grams 증가, deltaPct > 0', () => {
    const r = counterfactual(base, { variable: 'weightKg', delta: 1 })
    assert.ok(r.delta > 0)
    assert.ok(r.deltaPct > 0)
    assert.match(r.description, /\+1\.0 kg/)
  })

  it('BCS +2 (5 → 7) → grams 감소', () => {
    const r = counterfactual(base, { variable: 'bcs', delta: 2 })
    assert.ok(r.delta < 0)
  })

  it('활동 +0.2 → grams 증가', () => {
    const r = counterfactual(base, {
      variable: 'activityFactor',
      delta: 0.2,
    })
    assert.ok(r.delta > 0)
  })

  it('lifeStage adult → puppy → grams 증가', () => {
    const r = counterfactual(base, {
      variable: 'lifeStage',
      value: 'puppy',
    })
    assert.ok(r.delta > 0)
  })

  it('BCS clamp 1~9 — overflow 보호', () => {
    const r = counterfactual({ ...base, bcs: 9 }, { variable: 'bcs', delta: 5 })
    // 14 가 아니라 9 로 clamp → delta=0
    assert.equal(r.delta, 0)
  })
})

describe('sensitivityAnalysis', () => {
  it('|delta| 내림차순 정렬', () => {
    const results = sensitivityAnalysis(base)
    for (let i = 0; i < results.length - 1; i += 1) {
      assert.ok(
        Math.abs(results[i].delta) >= Math.abs(results[i + 1].delta),
        `${i}: ${results[i].delta} < ${results[i + 1].delta}`,
      )
    }
  })

  it('기본 6개 perturbation', () => {
    const results = sensitivityAnalysis(base)
    assert.equal(results.length, 6)
  })
})
