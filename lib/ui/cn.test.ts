import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cn } from './cn.ts'

/**
 * lib/ui/cn.ts — 가벼운 classname merger.
 *
 * 회귀 가드:
 *  - falsy (null/undefined/false) 무시
 *  - nested array flatten
 *  - 중복 공백 1개로 정리
 */

describe('cn', () => {
  it('단순 문자열 join', () => {
    assert.equal(cn('a', 'b', 'c'), 'a b c')
  })

  it('빈 입력 → 빈 문자열', () => {
    assert.equal(cn(), '')
    assert.equal(cn(''), '')
  })

  it('falsy 제거 — null/undefined/false', () => {
    assert.equal(cn('a', null, 'b'), 'a b')
    assert.equal(cn('a', undefined, 'b'), 'a b')
    assert.equal(cn('a', false, 'b'), 'a b')
  })

  it('조건부 className 패턴', () => {
    const active = true
    const disabled = false
    assert.equal(
      cn('btn', active && 'btn-active', disabled && 'btn-disabled'),
      'btn btn-active',
    )
  })

  it('배열 flatten (as const tuple 패턴)', () => {
    const base = ['rounded', 'px-3'] as const
    assert.equal(cn(base, 'text-ink'), 'rounded px-3 text-ink')
  })

  it('nested 배열도 flatten', () => {
    const outer = [['a', 'b'], 'c'] as const
    assert.equal(cn(outer), 'a b c')
  })

  it('중복 공백 정리 → 1 개', () => {
    assert.equal(cn('a   b', 'c'), 'a b c')
    assert.equal(cn('a', ' b ', 'c'), 'a b c')
  })

  it('앞뒤 공백 trim', () => {
    assert.equal(cn(' a ', ' b '), 'a b')
  })

  it('모두 falsy → 빈 문자열', () => {
    assert.equal(cn(false, null, undefined), '')
    assert.equal(cn(false && 'never'), '')
  })

  it('호출자 className 뒤에 추가 (override 패턴)', () => {
    // 흔한 패턴 — base + className. 같은 prop 충돌 시 뒤가 이김 (Tailwind v4).
    const base = 'px-3 py-2 rounded'
    const override = 'px-4'
    assert.equal(cn(base, override), 'px-3 py-2 rounded px-4')
  })
})
