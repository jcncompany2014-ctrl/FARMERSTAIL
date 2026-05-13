import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeChatNudge } from './proactive-nudges.ts'

const base = {
  dogName: '초롱이',
  latestBcs: null,
  daysSinceLastWeight: null,
  allergiesSource: 'unknown' as const,
  daysSinceSignup: 60, // grace 외
}

describe('computeChatNudge', () => {
  it('BCS 7 → bcs_high', () => {
    const n = computeChatNudge({ ...base, latestBcs: 7 })
    assert.equal(n?.reason, 'bcs_high')
    assert.match(n!.message, /초롱이/)
  })

  it('BCS 3 → bcs_low', () => {
    const n = computeChatNudge({ ...base, latestBcs: 3 })
    assert.equal(n?.reason, 'bcs_low')
  })

  it('BCS 5 (정상) → first_chat fallthrough', () => {
    const n = computeChatNudge({ ...base, latestBcs: 5 })
    assert.equal(n?.reason, 'first_chat')
  })

  it('체중 14일 미기록 → stale_weight', () => {
    const n = computeChatNudge({ ...base, daysSinceLastWeight: 20 })
    assert.equal(n?.reason, 'stale_weight')
  })

  it('체중 7일 (정상 범위) → first_chat', () => {
    const n = computeChatNudge({ ...base, daysSinceLastWeight: 7 })
    assert.equal(n?.reason, 'first_chat')
  })

  it('알레르기 자가진단 → allergy_unverified', () => {
    const n = computeChatNudge({ ...base, allergiesSource: 'self_suspected' })
    assert.equal(n?.reason, 'allergy_unverified')
  })

  it('vet_diagnosed 는 nudge 없음 → first_chat', () => {
    const n = computeChatNudge({ ...base, allergiesSource: 'vet_diagnosed' })
    assert.equal(n?.reason, 'first_chat')
  })

  it('첫 4주 보호 phase 안에서는 임상 nudge 모두 skip → first_chat', () => {
    const inGrace = { ...base, daysSinceSignup: 5 }
    assert.equal(
      computeChatNudge({ ...inGrace, latestBcs: 8 })?.reason,
      'first_chat',
    )
    assert.equal(
      computeChatNudge({ ...inGrace, daysSinceLastWeight: 30 })?.reason,
      'first_chat',
    )
    assert.equal(
      computeChatNudge({
        ...inGrace,
        allergiesSource: 'self_suspected',
      })?.reason,
      'first_chat',
    )
  })

  it('우선순위: BCS extreme > weight stale > allergy', () => {
    const n = computeChatNudge({
      ...base,
      latestBcs: 8,
      daysSinceLastWeight: 20,
      allergiesSource: 'self_suspected',
    })
    assert.equal(n?.reason, 'bcs_high')
  })

  it('dogName null → "강아지" 라벨', () => {
    const n = computeChatNudge({
      ...base,
      dogName: null,
      latestBcs: 8,
    })
    assert.match(n!.message, /강아지/)
  })
})
