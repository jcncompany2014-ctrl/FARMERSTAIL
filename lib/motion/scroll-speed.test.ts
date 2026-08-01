/**
 * scrollSpeedFactor — 재료 스트립 배속 매핑.
 *
 * 이 테스트가 있는 이유: 브라우저에서 "위로 튕기면 되감긴다"를 확인하려 했는데
 * 합성 스크롤의 속도 측정치가 회차마다 -228 ~ -1560 으로 튀어 **판정이 안 됐다**.
 * 눈으로 못 보는 것을 "된다"고 말하지 않기 위해, 매핑을 순수 함수로 빼고 여기서
 * 못 박는다. 브라우저에서 확인한 것은 "반응한다"(timeScale 1.51 실측)까지다.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  scrollSpeedFactor,
  SPEED_CLAMP,
  SPEED_DIVISOR,
} from './scroll-speed.ts'

describe('scrollSpeedFactor', () => {
  it('멈춰 있으면 등속(1)', () => {
    assert.equal(scrollSpeedFactor(0), 1)
  })

  it('아래로 스크롤하면 빨라진다', () => {
    assert.ok(scrollSpeedFactor(400) > 1)
    assert.equal(scrollSpeedFactor(400), 2)
  })

  it('★위로 튕기면 역주행한다 (timeScale 음수)', () => {
    // 되감김이 이 효과의 핵심 — v < -SPEED_DIVISOR 부터 음수여야 한다.
    assert.equal(scrollSpeedFactor(-SPEED_DIVISOR), 0)
    assert.ok(scrollSpeedFactor(-800) < 0, '-800 에서 되감기지 않는다')
    assert.equal(scrollSpeedFactor(-800), -1)
  })

  it('위로 살살 올리면 느려지되 방향은 유지', () => {
    const f = scrollSpeedFactor(-200)
    assert.ok(f > 0 && f < 1, `-200 은 감속이어야 하는데 ${f}`)
  })

  it('★관성 폭주는 clamp — 스트립이 순간이동하지 않는다', () => {
    assert.equal(scrollSpeedFactor(999_999), SPEED_CLAMP)
    assert.equal(scrollSpeedFactor(-999_999), -SPEED_CLAMP)
  })

  it('★NaN·Infinity 는 등속으로 — timeScale 에 새면 트윈이 죽는다', () => {
    assert.equal(scrollSpeedFactor(NaN), 1)
    assert.equal(scrollSpeedFactor(Infinity), 1)
    assert.equal(scrollSpeedFactor(-Infinity), 1)
  })

  it('단조증가 — 빨리 내릴수록 반드시 더 빠르다', () => {
    let prev = -Infinity
    for (const v of [-3000, -800, -400, -100, 0, 100, 400, 800, 3000]) {
      const f = scrollSpeedFactor(v)
      assert.ok(f >= prev, `단조성 깨짐: v=${v}`)
      prev = f
    }
  })
})
