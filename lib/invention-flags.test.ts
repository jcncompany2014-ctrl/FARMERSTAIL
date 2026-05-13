import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isInventionEnabled } from './invention-flags.ts'

const ENV_KEYS = [
  'NEXT_PUBLIC_INVENTION_CORE',
  'NEXT_PUBLIC_INVENTION_META_LEARNING',
  'NEXT_PUBLIC_INVENTION_COUNTERFACTUAL',
  'NEXT_PUBLIC_INVENTION_PERSONA',
  'NEXT_PUBLIC_INVENTION_W_IMAGE',
]

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k]
}

describe('isInventionEnabled', () => {
  beforeEach(clearEnv)
  afterEach(clearEnv)

  it('default 모두 OFF (env 미설정)', () => {
    assert.equal(isInventionEnabled('core'), false)
    assert.equal(isInventionEnabled('meta_learning'), false)
    assert.equal(isInventionEnabled('persona'), false)
  })

  it('core OFF 면 sub feature 모두 OFF (cascade)', () => {
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
    assert.equal(isInventionEnabled('meta_learning'), false)
  })

  it('core ON + sub 미지정 → inherit (sub ON)', () => {
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    assert.equal(isInventionEnabled('core'), true)
    assert.equal(isInventionEnabled('persona'), true)
    assert.equal(isInventionEnabled('meta_learning'), true)
  })

  it('core ON + sub off → 그 sub 만 OFF', () => {
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'off'
    assert.equal(isInventionEnabled('persona'), true)
    assert.equal(isInventionEnabled('meta_learning'), false)
  })

  it("'on' 이외 값은 OFF 처리", () => {
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'true'
    assert.equal(isInventionEnabled('core'), false)
    process.env.NEXT_PUBLIC_INVENTION_CORE = '1'
    assert.equal(isInventionEnabled('core'), false)
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    assert.equal(isInventionEnabled('core'), true)
  })
})
