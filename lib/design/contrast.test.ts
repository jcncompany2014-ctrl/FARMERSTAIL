import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  contrastRatio,
  luminance,
  passesAA,
  passesAAA,
  V3_CONTRAST_PAIRS,
} from './contrast.ts'
import { billingMethod } from '../payments/billing-methods.ts'

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

  it("★ use:'text' 조합은 전부 AA(4.5:1) 통과", () => {
    // 예전 이 테스트는 `1 < r <= 21` 만 봤다 — **AA 미달을 잡을 수 없는 검사**였다.
    // 그래서 '시작 전' 칩이 1.69:1 인 채로, 토스페이 버튼이 3.72:1 인 채로 통과했다.
    // 표는 이제 토큰에서 파생되므로, 토큰을 낮추면 여기서 바로 깨진다.
    const failed = V3_CONTRAST_PAIRS.filter(
      (p) => p.use === 'text' && contrastRatio(p.fg, p.bg) < 4.5,
    ).map((p) => `${p.name} = ${contrastRatio(p.fg, p.bg).toFixed(2)}:1 (${p.purpose})`)
    assert.deepEqual(
      failed,
      [],
      '글자색으로 쓰는 조합이 AA 미달이다. 색을 어둡게 하거나, 텍스트로 쓰지 ' +
        "않는다면 use:'deco' 로 옮기고 이유를 적을 것.\n" + failed.join('\n'),
    )
  })

  it("use:'deco' 조합은 텍스트 기준을 넘지 않는다고 표시돼 있다", () => {
    // deco 로 빼놓고 실제로는 AA 를 넉넉히 통과하는 색이면, 텍스트로 못 쓴다고
    // 잘못 표시해 둔 것이다(쓸 수 있는 색을 못 쓰게 만든다) → 분류를 고친다.
    const misfiled = V3_CONTRAST_PAIRS.filter(
      (p) => p.use === 'deco' && contrastRatio(p.fg, p.bg) >= 4.5,
    ).map((p) => p.name)
    assert.deepEqual(
      misfiled,
      [],
      `AA 를 통과하는데 deco 로 분류돼 있다: ${misfiled.join(', ')}`,
    )
  })

  it('토스페이 버튼의 흰 글씨가 AA 통과 (브랜드색 회귀 방지)', () => {
    // 처음 Blue 500(#3182F6)을 썼다가 3.72:1 로 AA 미달이었다. 버튼 라벨이
    // 14px bold 라 large-text 예외(18.66px bold↑)에도 못 든다.
    const tosspay = billingMethod('tosspay')
    assert.ok(tosspay.brandColor, '토스페이는 브랜드색을 가진다')
    const r = contrastRatio('#ffffff', tosspay.brandColor!)
    assert.ok(r >= 4.5, `흰 글씨 대비 ${r.toFixed(2)}:1 — 4.5 이상이어야 한다`)
  })

  it('handles invalid hex gracefully', () => {
    assert.doesNotThrow(() => contrastRatio('bogus', '#fff'))
  })
})
