import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  decayingEpsilon,
  epsilonGreedy,
  recordReward,
  type Arm,
} from './exploration.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
})

function makeArm(id: string, reward: number, trials: number): Arm<string> {
  return { id, value: id, reward, trials }
}

describe('epsilonGreedy', () => {
  it('flag ON, exploit (random > epsilon) → best arm', () => {
    const arms = [
      makeArm('a', 10, 5), // 2.0 mean
      makeArm('b', 30, 5), // 6.0 mean
      makeArm('c', 15, 5), // 3.0 mean
    ]
    // random=0.99 > eps=0.1 → exploit
    const r = epsilonGreedy(arms, 0.1, () => 0.99)
    assert.equal(r?.id, 'b')
  })

  it('flag ON, explore (random < epsilon) → random arm', () => {
    const arms = [makeArm('a', 100, 5), makeArm('b', 0, 5)]
    // random=0.05 < eps=0.1 → explore. floor(0.05*2)=0 → 'a'
    const r = epsilonGreedy(arms, 0.1, () => 0.05)
    assert.ok(r?.id === 'a' || r?.id === 'b')
  })

  it('flag OFF → 첫 arm fallback', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_CORE
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    const arms = [makeArm('a', 0, 0), makeArm('b', 1000, 5)]
    const r = epsilonGreedy(arms, 0.1)
    assert.equal(r?.id, 'a')
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  })

  it('빈 array → null', () => {
    assert.equal(epsilonGreedy([] as Arm<string>[]), null)
  })

  it('단일 arm → 그 arm', () => {
    const arms = [makeArm('only', 5, 1)]
    assert.equal(epsilonGreedy(arms)?.id, 'only')
  })
})

describe('decayingEpsilon', () => {
  it('t=0 → initial', () => {
    assert.equal(decayingEpsilon(0, 0.3, 0.95), 0.3)
  })
  it('t=10 → decay', () => {
    const e = decayingEpsilon(10, 0.3, 0.95)
    assert.ok(e < 0.3 && e > 0.1)
  })
  it('min clamp', () => {
    const e = decayingEpsilon(1000, 0.3, 0.95, 0.05)
    assert.equal(e, 0.05)
  })
})

describe('recordReward', () => {
  it('reward + trials 누적', () => {
    const arm = makeArm('a', 5, 2)
    const next = recordReward(arm, 3)
    assert.equal(next.reward, 8)
    assert.equal(next.trials, 3)
  })
})
