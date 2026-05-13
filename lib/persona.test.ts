import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { computePersona } from './persona.ts'

// persona flag default OFF → 테스트 전체에서 ON 으로 강제.
// PCT 가드 (lib/invention-flags) 는 별도 invention-flags.test.ts 가 검증.
before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_PERSONA = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_PERSONA
})

const base = {
  chatCount: 0,
  analysisCount: 0,
  checkinCount: 0,
  diaryCount: 0,
  hasPhoto: false,
  hasSubscription: false,
  allergiesSource: 'unknown' as const,
  daysSinceSignup: 90,
}

describe('computePersona', () => {
  it('가입 < 7일이면 dominant null', () => {
    const r = computePersona({ ...base, daysSinceSignup: 3, analysisCount: 10 })
    assert.equal(r.dominant, null)
    assert.equal(r.scores.data_lover, 0)
  })

  it('분석/체크인 풍부 → data_lover dominant', () => {
    const r = computePersona({
      ...base,
      analysisCount: 5,
      checkinCount: 8,
    })
    assert.equal(r.dominant, 'data_lover')
  })

  it('일지/사진 많음 → emotional dominant', () => {
    const r = computePersona({
      ...base,
      diaryCount: 12,
      hasPhoto: true,
    })
    assert.equal(r.dominant, 'emotional')
  })

  it('정기배송 활성 → convenience dominant', () => {
    const r = computePersona({
      ...base,
      hasSubscription: true,
    })
    assert.equal(r.dominant, 'convenience')
  })

  it('챗봇 + vet_diagnosed → vet_dependent dominant', () => {
    const r = computePersona({
      ...base,
      chatCount: 15,
      allergiesSource: 'vet_diagnosed',
    })
    assert.equal(r.dominant, 'vet_dependent')
  })

  it('모두 0 → dominant null', () => {
    const r = computePersona(base)
    assert.equal(r.dominant, null)
    assert.equal(r.secondary, null)
  })

  it('secondary 도 threshold 통과 시 set', () => {
    // diary 많음 + 사진 (emotional 1.0) > 약한 convenience (0.3 가입일 + 0 sub)
    // 그러나 convenience 가 threshold 통과하도록 daysSinceSignup 의도적으로 큼
    const r = computePersona({
      ...base,
      diaryCount: 10,
      hasPhoto: true,
      analysisCount: 3,
    })
    assert.equal(r.dominant, 'emotional')
    assert.equal(r.secondary, 'data_lover')
  })

  it('점수는 [0,1] 범위', () => {
    const r = computePersona({
      ...base,
      analysisCount: 100,
      checkinCount: 100,
      diaryCount: 100,
      chatCount: 100,
      hasPhoto: true,
      hasSubscription: true,
      allergiesSource: 'vet_diagnosed',
    })
    for (const v of Object.values(r.scores)) {
      assert.ok(v >= 0 && v <= 1, `out of range: ${v}`)
    }
  })
})
