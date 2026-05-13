import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { computeWImage } from './w-image.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_W_IMAGE = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_W_IMAGE
})

const ideal = {
  coverageRatio: 0.6,
  brightness: 140,
  sharpness: 200,
  referenceFound: true,
  viewType: 'side' as const,
}

describe('computeWImage', () => {
  it('이상적 입력 → score 1.0 + usable', () => {
    const r = computeWImage(ideal)
    assert.equal(r.score, 1)
    assert.equal(r.usable, true)
    assert.equal(r.issues.length, 0)
  })

  it('flag OFF 면 0 + usable=false', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_CORE
    const r = computeWImage(ideal)
    assert.equal(r.score, 0)
    assert.equal(r.usable, false)
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  })

  it('너무 어두움 → brightness 감점', () => {
    const r = computeWImage({ ...ideal, brightness: 40 })
    assert.ok(r.score < 1)
    assert.ok(r.issues.some((m) => m.includes('어두')))
  })

  it('흐림 → sharpness 감점', () => {
    const r = computeWImage({ ...ideal, sharpness: 20 })
    assert.ok(r.score < 1)
    assert.ok(r.issues.some((m) => m.includes('흐려')))
  })

  it('참조 객체 없음 → 감점 + 안내', () => {
    const r = computeWImage({ ...ideal, referenceFound: false })
    assert.ok(r.score < 1)
    assert.ok(r.issues.some((m) => m.includes('참조')))
  })

  it('view unknown → 감점', () => {
    const r = computeWImage({ ...ideal, viewType: 'unknown' })
    assert.ok(r.score < 1)
  })

  it('coverage 부족 → 감점', () => {
    const r = computeWImage({ ...ideal, coverageRatio: 0.2 })
    assert.ok(r.score < 1)
    assert.ok(r.issues.some((m) => m.includes('작게')))
  })

  it('극단적 나쁨 → score < 0.5 → usable=false', () => {
    const r = computeWImage({
      coverageRatio: 0.1,
      brightness: 30,
      sharpness: 10,
      referenceFound: false,
      viewType: 'unknown',
    })
    assert.ok(r.score < 0.5)
    assert.equal(r.usable, false)
  })
})
