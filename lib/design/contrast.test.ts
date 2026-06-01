import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  contrastRatio,
  luminance,
  passesAA,
  passesAAA,
  V3_CONTRAST_PAIRS,
} from './contrast.ts'

describe('contrast', () => {
  it('luminance black/white', () => {
    assert.ok(Math.abs(luminance('#000000') - 0) < 1e-5)
    assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-5)
  })

  it('contrast ratio black on white', () => {
    const r = contrastRatio('#000000', '#ffffff')
    assert.ok(r > 20.5 && r < 21.5, `expected ~21, got ${r}`)
  })

  it('ink on paper passes AAA body', () => {
    const r = contrastRatio('#16140f', '#f4ede0')
    assert.ok(r > 7, `expected >7, got ${r}`)
    assert.equal(passesAAA('#16140f', '#f4ede0'), true)
  })

  it('inkMute on paper passes AA body (P1-A2 darken)', () => {
    // 마스터피스 P1-A2: app 라이트 mute 를 #7d7460(3.97, AA large only) →
    // #706854(4.75, AA body) 로 darken. ≤13.5px 본문 ~859곳 AA 충족.
    const r = contrastRatio('#706854', '#f4ede0')
    assert.equal(passesAA('#706854', '#f4ede0'), true)
    assert.ok(r >= 4.5, `expected >=4.5, got ${r}`)
  })

  it('inkSoft on paper passes AA body', () => {
    assert.equal(passesAA('#3a342a', '#f4ede0'), true)
  })

  it('all standard pairs computed without error', () => {
    for (const pair of V3_CONTRAST_PAIRS) {
      const r = contrastRatio(pair.fg, pair.bg)
      assert.ok(r > 1, `${pair.name} ratio too low: ${r}`)
      assert.ok(r <= 21, `${pair.name} ratio too high: ${r}`)
    }
  })

  it('handles invalid hex gracefully', () => {
    assert.doesNotThrow(() => contrastRatio('bogus', '#fff'))
  })
})
