import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  upgradeTier,
  isUpgrade,
  rewardAmount,
  rewardReason,
  makeReferenceId,
  UPGRADE_REWARD_AMOUNT,
  UPGRADE_REWARD_PARTIAL,
} from './measurement-upgrade.ts'

/**
 * lib/rewards/measurement-upgrade.ts — 측정 도구 개선 보상 (A-12).
 *
 * 회귀 가드:
 *  - audit #25: 3-tier 분리 (이전 home_analog MID 미보상 issue)
 *  - low_to_high = 1000P, low_to_mid / mid_to_high = 500P
 *  - 멱등성 referenceId 형식 (`${dogId}:${kind}`)
 */

describe('upgradeTier — weight', () => {
  it('eyeball → vet_scale → low_to_high', () => {
    assert.equal(upgradeTier('weight', 'eyeball', 'vet_scale'), 'low_to_high')
  })

  it('audit #25 — eyeball → home_analog → low_to_mid (이전 0P, 새 500P)', () => {
    assert.equal(upgradeTier('weight', 'eyeball', 'home_analog'), 'low_to_mid')
  })

  it('home_analog → home_digital → mid_to_high', () => {
    assert.equal(
      upgradeTier('weight', 'home_analog', 'home_digital'),
      'mid_to_high',
    )
  })

  it('vet_scale → home_digital → null (같은 HIGH 그룹)', () => {
    assert.equal(upgradeTier('weight', 'vet_scale', 'home_digital'), null)
  })

  it('home_digital → eyeball → null (downgrade)', () => {
    assert.equal(upgradeTier('weight', 'home_digital', 'eyeball'), null)
  })

  it('prev null → unknown 으로 처리 → upgrade 가능', () => {
    assert.equal(upgradeTier('weight', null, 'vet_scale'), 'low_to_high')
    assert.equal(upgradeTier('weight', undefined, 'home_analog'), 'low_to_mid')
  })
})

describe('upgradeTier — activity (MID 없음)', () => {
  it('subjective → pedometer → low_to_high', () => {
    assert.equal(
      upgradeTier('activity', 'subjective', 'pedometer'),
      'low_to_high',
    )
  })

  it('unknown → gps → low_to_high', () => {
    assert.equal(upgradeTier('activity', 'unknown', 'gps'), 'low_to_high')
  })

  it('pedometer → gps → null (둘 다 HIGH)', () => {
    assert.equal(upgradeTier('activity', 'pedometer', 'gps'), null)
  })
})

describe('upgradeTier — feed (MID 없음)', () => {
  it('eyeball → scale → low_to_high', () => {
    assert.equal(upgradeTier('feed', 'eyeball', 'scale'), 'low_to_high')
  })

  it('cup → auto_delivery → low_to_high (D2C 차별화)', () => {
    assert.equal(
      upgradeTier('feed', 'cup', 'auto_delivery'),
      'low_to_high',
    )
  })

  it('scale → auto_delivery → null (둘 다 HIGH)', () => {
    assert.equal(upgradeTier('feed', 'scale', 'auto_delivery'), null)
  })
})

describe('upgradeTier — edge cases', () => {
  it('next null/undefined → null', () => {
    assert.equal(upgradeTier('weight', 'eyeball', null), null)
    assert.equal(upgradeTier('weight', 'eyeball', undefined), null)
  })

  it('unknown next 값 → null (정의 안 된 method)', () => {
    assert.equal(upgradeTier('weight', 'eyeball', 'mystery_method'), null)
  })
})

describe('isUpgrade (deprecated 호환)', () => {
  it('low_to_high 케이스 → true', () => {
    assert.equal(isUpgrade('weight', 'eyeball', 'vet_scale'), true)
  })

  it('low_to_mid → false (deprecated 는 low_to_high 만)', () => {
    assert.equal(isUpgrade('weight', 'eyeball', 'home_analog'), false)
  })

  it('mid_to_high → false', () => {
    assert.equal(isUpgrade('weight', 'home_analog', 'home_digital'), false)
  })

  it('null tier → false', () => {
    assert.equal(isUpgrade('weight', 'vet_scale', 'vet_scale'), false)
  })
})

describe('rewardAmount', () => {
  it('low_to_high → 1000P (UPGRADE_REWARD_AMOUNT)', () => {
    assert.equal(rewardAmount('low_to_high'), UPGRADE_REWARD_AMOUNT)
    assert.equal(rewardAmount('low_to_high'), 1000)
  })

  it('low_to_mid → 500P (audit #25 부분 보상)', () => {
    assert.equal(rewardAmount('low_to_mid'), UPGRADE_REWARD_PARTIAL)
    assert.equal(rewardAmount('low_to_mid'), 500)
  })

  it('mid_to_high → 500P', () => {
    assert.equal(rewardAmount('mid_to_high'), UPGRADE_REWARD_PARTIAL)
  })

  it('null → 0P', () => {
    assert.equal(rewardAmount(null), 0)
  })

  it('low_to_high > low_to_mid (정확도 큰 향상에 더 큰 보상)', () => {
    assert.ok(rewardAmount('low_to_high') > rewardAmount('low_to_mid'))
  })
})

describe('rewardReason', () => {
  it('weight → 체중 측정 도구 메시지', () => {
    assert.match(rewardReason('weight'), /체중/)
  })

  it('activity → 활동량 측정 도구 메시지', () => {
    assert.match(rewardReason('activity'), /활동량/)
  })

  it('feed → 급여량 측정 도구 메시지', () => {
    assert.match(rewardReason('feed'), /급여량/)
  })

  it('모두 "응원 포인트" 어휘 (voice-guidelines § 칭찬 톤)', () => {
    for (const k of ['weight', 'activity', 'feed'] as const) {
      assert.match(rewardReason(k), /응원/)
    }
  })
})

describe('makeReferenceId (멱등성)', () => {
  it('형식 `${dogId}:${kind}`', () => {
    assert.equal(makeReferenceId('dog-1', 'weight'), 'dog-1:weight')
    assert.equal(makeReferenceId('dog-1', 'activity'), 'dog-1:activity')
    assert.equal(makeReferenceId('dog-1', 'feed'), 'dog-1:feed')
  })

  it('같은 (dog, kind) 조합 → 같은 referenceId (멱등성)', () => {
    const a = makeReferenceId('dog-1', 'weight')
    const b = makeReferenceId('dog-1', 'weight')
    assert.equal(a, b)
  })

  it('다른 dog 또는 다른 kind → 다른 referenceId', () => {
    assert.notEqual(
      makeReferenceId('dog-1', 'weight'),
      makeReferenceId('dog-2', 'weight'),
    )
    assert.notEqual(
      makeReferenceId('dog-1', 'weight'),
      makeReferenceId('dog-1', 'activity'),
    )
  })
})
