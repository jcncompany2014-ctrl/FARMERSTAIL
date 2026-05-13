import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  breedDistance,
  reliabilityWeightedMean,
  clusterMeanBySize,
  correlationCheck,
} from './cluster.ts'
import { findBreed, sizeFromBreedOrWeight } from './registry.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_W_IMAGE = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_W_IMAGE
})

describe('breedDistance', () => {
  it('같은 견종 = 0', () => {
    assert.equal(breedDistance('beagle', 'beagle'), 0)
  })

  it('같은 size + 활동 비슷 → 작은 거리', () => {
    const d = breedDistance('pomeranian', 'maltese')
    assert.ok(d <= 0.3)
  })

  it('다른 size + 활동 다름 → 큰 거리', () => {
    const d = breedDistance('chihuahua', 'great_dane')
    assert.ok(d >= 0.6)
  })

  it('mix 는 항상 0.5', () => {
    assert.equal(breedDistance('mix', 'beagle'), 0.5)
  })
})

describe('reliabilityWeightedMean', () => {
  it('w=1 → 사용자 값', () => {
    assert.equal(reliabilityWeightedMean(10, 5, 1), 10)
  })
  it('w=0 → cluster 값', () => {
    assert.equal(reliabilityWeightedMean(10, 5, 0), 5)
  })
  it('w=0.5 → 평균', () => {
    assert.equal(reliabilityWeightedMean(10, 5, 0.5), 7.5)
  })
})

describe('clusterMeanBySize', () => {
  it('toy size 평균 체중 < 5kg', () => {
    const m = clusterMeanBySize('toy')
    assert.ok(m.avgWeight < 5)
  })
  it('giant size 평균 체중 > 50kg', () => {
    const m = clusterMeanBySize('giant')
    assert.ok(m.avgWeight > 50)
  })
})

describe('sizeFromBreedOrWeight', () => {
  it('weight 우선 분류', () => {
    assert.equal(sizeFromBreedOrWeight('beagle', 2), 'toy') // breed=medium 인데 weight=2 → toy
  })
  it('weight 없으면 breed', () => {
    assert.equal(sizeFromBreedOrWeight('beagle', null), 'medium')
  })
})

describe('correlationCheck', () => {
  it('flag ON + 체중↑+활동↓ → 안내', () => {
    const r = correlationCheck({
      weightDeltaPct: 10,
      activityDeltaCategory: -1,
      bcs: 5,
      activityLevel: 3,
    })
    assert.ok(r.length > 0)
  })
  it('BCS 7+ + 활동 5 → 모순 안내', () => {
    const r = correlationCheck({
      weightDeltaPct: null,
      activityDeltaCategory: null,
      bcs: 8,
      activityLevel: 5,
    })
    assert.ok(r.length > 0)
  })
})

describe('flag OFF fallback', () => {
  it('flag OFF 시 breedDistance fallback', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_W_IMAGE
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    const d = breedDistance('beagle', 'pomeranian')
    assert.ok(d >= 0 && d <= 1)
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    process.env.NEXT_PUBLIC_INVENTION_W_IMAGE = 'on'
  })
})

describe('registry', () => {
  it('포메라니안 lookup', () => {
    const b = findBreed('pomeranian')
    assert.ok(b)
    assert.equal(b!.size, 'toy')
  })
  it('진돗개 = 한국 견종', () => {
    const b = findBreed('jindo')
    assert.equal(b?.korean, true)
  })
})
