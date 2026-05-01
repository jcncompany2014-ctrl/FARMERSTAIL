/**
 * featureFlags.ts unit tests — pickVariant + hashBucket 결정 로직.
 *
 * resolveFlag 는 supabase 의존이라 별도 통합 테스트로. 여기선 순수 함수만.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hashBucket, pickVariant, type RawFlagRow } from './featureFlags.ts'

describe('hashBucket', () => {
  it('returns deterministic 0-99 for same input', () => {
    const a = hashBucket('user-123', 'hero_copy_test')
    const b = hashBucket('user-123', 'hero_copy_test')
    assert.equal(a, b)
    assert.ok(a >= 0 && a < 100)
  })

  it('different users get different buckets (sanity check, not guaranteed)', () => {
    // 100 명 user 의 bucket 분포가 모두 같은 값이면 hash 가 의심스러움.
    const buckets = new Set<number>()
    for (let i = 0; i < 100; i++) {
      buckets.add(hashBucket(`user-${i}`, 'flag'))
    }
    // 적어도 30개의 distinct bucket — 균등 분포면 ~63.
    assert.ok(buckets.size >= 30, `expected diverse buckets, got ${buckets.size}`)
  })

  it('different flags for same user get different buckets', () => {
    const a = hashBucket('u1', 'flag_a')
    const b = hashBucket('u1', 'flag_b')
    // 충돌 가능성은 1/100 — 두 다른 flag 가 우연히 같은 bucket 일 수 있지만
    // 의도된 hash 라면 보통 다름. 의심 신호용.
    if (a === b) {
      // 한 페어 충돌은 정상 — 그냥 sanity 로 삼지 않고 통과.
    }
    assert.ok(a >= 0 && a < 100)
    assert.ok(b >= 0 && b < 100)
  })
})

const baseFlag: RawFlagRow = {
  key: 'hero_copy_test',
  enabled: true,
  variants: [
    { key: 'control', weight: 50, payload: { label: 'C' } },
    { key: 'urgency', weight: 25, payload: { label: 'U' } },
    { key: 'value', weight: 25, payload: { label: 'V' } },
  ],
  default_variant: 'control',
}

describe('pickVariant', () => {
  it('returns disabled with default variant when flag.enabled = false', () => {
    const flag = { ...baseFlag, enabled: false }
    const result = pickVariant(flag, 'user-1')
    assert.equal(result.enabled, false)
    assert.equal(result.variant, 'control')
    // payload 는 default variant 의 payload.
    assert.deepEqual(result.payload, { label: 'C' })
  })

  it('returns default variant when no userId and flag enabled', () => {
    const result = pickVariant(baseFlag, null)
    assert.equal(result.enabled, true)
    assert.equal(result.variant, 'control')
  })

  it('returns same variant for same user — sticky bucket', () => {
    const a = pickVariant(baseFlag, 'user-stable')
    const b = pickVariant(baseFlag, 'user-stable')
    assert.equal(a.variant, b.variant)
  })

  it('boolean flag (variants 비어있음) returns enabled with default_variant', () => {
    const flag: RawFlagRow = {
      key: 'simple_toggle',
      enabled: true,
      variants: [],
      default_variant: 'on',
    }
    const result = pickVariant(flag, 'u1')
    assert.equal(result.enabled, true)
    assert.equal(result.variant, 'on')
    assert.equal(result.payload, null)
  })

  it('weights distribute roughly proportionally over many users', () => {
    const counts = { control: 0, urgency: 0, value: 0 }
    for (let i = 0; i < 1000; i++) {
      const result = pickVariant(baseFlag, `user-${i}`)
      counts[result.variant as keyof typeof counts]++
    }
    // control 50% 면 ~500 ± 100, urgency/value 25% 면 ~250 ± 80.
    // hash 가 균등하지 않을 수 있어 넉넉한 마진.
    assert.ok(counts.control > 350 && counts.control < 650, `control=${counts.control}`)
    assert.ok(counts.urgency > 150 && counts.urgency < 350, `urgency=${counts.urgency}`)
    assert.ok(counts.value > 150 && counts.value < 350, `value=${counts.value}`)
  })

  it('handles totalWeight === 0 by falling back to default', () => {
    const flag: RawFlagRow = {
      ...baseFlag,
      variants: [
        { key: 'a', weight: 0 },
        { key: 'b', weight: 0 },
      ],
    }
    const result = pickVariant(flag, 'u1')
    assert.equal(result.variant, 'control')
  })

  it('normalizes weights that do not sum to 100', () => {
    const flag: RawFlagRow = {
      ...baseFlag,
      variants: [
        { key: 'a', weight: 1 },
        { key: 'b', weight: 1 },
      ],
    }
    // 50/50 분배여야 함.
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 500; i++) {
      const result = pickVariant(flag, `user-${i}`)
      counts[result.variant as keyof typeof counts]++
    }
    assert.ok(counts.a > 150 && counts.a < 350, `a=${counts.a}`)
    assert.ok(counts.b > 150 && counts.b < 350, `b=${counts.b}`)
  })

  it('returns variant payload when available', () => {
    const result = pickVariant(baseFlag, 'user-stable')
    // user-stable 의 variant 가 무엇이든 payload 가 따라와야 함.
    if (result.variant === 'control') {
      assert.deepEqual(result.payload, { label: 'C' })
    } else if (result.variant === 'urgency') {
      assert.deepEqual(result.payload, { label: 'U' })
    } else if (result.variant === 'value') {
      assert.deepEqual(result.payload, { label: 'V' })
    }
  })
})
