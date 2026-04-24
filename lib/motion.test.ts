import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { motion, motionStagger } from './motion.ts'

describe('motion presets', () => {
  it('exports every documented preset', () => {
    const expected = [
      'fadeIn',
      'fadeInUp',
      'fadeInDown',
      'scaleIn',
      'slideInRight',
      'slideInUp',
      'pulseSoft',
      'shimmer',
    ]
    for (const key of expected) {
      assert.ok(
        key in motion,
        `motion.${key} missing — globals.css and motion.ts must stay in sync`,
      )
    }
  })

  it('uses the `animate-` Tailwind prefix for every preset', () => {
    for (const value of Object.values(motion)) {
      assert.match(value, /^animate-/)
    }
  })
})

describe('motionStagger', () => {
  it('returns a CSSProperties-shaped object', () => {
    const out = motionStagger(3)
    assert.deepEqual(out, { animationDelay: '180ms' })
  })

  it('caps delay at 720ms to avoid a drawn-out cascade', () => {
    assert.deepEqual(motionStagger(100), { animationDelay: '720ms' })
  })

  it('accepts a custom step', () => {
    assert.deepEqual(motionStagger(2, 100), { animationDelay: '200ms' })
  })
})
