import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escape } from './escape.ts'

/**
 * lib/email/layout.ts — escape (HTML 삽입 XSS 가드).
 *
 * 회귀 가드:
 *  - 5종 entity 변환 (&, <, >, ", ')
 *  - script 태그 무력화
 *  - attribute 값 안전성 (단일/이중 따옴표 escape)
 */

describe('escape — XSS 가드', () => {
  it('& → &amp;', () => {
    assert.equal(escape('A & B'), 'A &amp; B')
  })

  it('< → &lt;', () => {
    assert.equal(escape('1 < 2'), '1 &lt; 2')
  })

  it('> → &gt;', () => {
    assert.equal(escape('a > b'), 'a &gt; b')
  })

  it('" → &quot; (attribute 안전)', () => {
    assert.equal(escape('say "hi"'), 'say &quot;hi&quot;')
  })

  it("' → &#39; (single-quote attribute 안전)", () => {
    assert.equal(escape("it's"), 'it&#39;s')
  })

  it('script 태그 무력화', () => {
    const dangerous = '<script>alert(1)</script>'
    const safe = escape(dangerous)
    assert.ok(!safe.includes('<script'))
    assert.ok(!safe.includes('</script>'))
    assert.match(safe, /&lt;script&gt;/)
  })

  it('img onerror 같은 attribute injection 무력화', () => {
    const dangerous = '<img src=x onerror="alert(1)">'
    const safe = escape(dangerous)
    assert.ok(!safe.includes('<img'))
    assert.ok(!safe.includes('"'))
  })

  it('& 우선 변환 — 다른 entity 재인코딩 X', () => {
    // 만약 & 가 마지막에 처리되면 &lt; → &amp;lt; 가 되어 깨짐.
    // 정책: & 가 먼저, 그 후 < > " ' 순.
    assert.equal(escape('<&>'), '&lt;&amp;&gt;')
  })

  it('빈 문자열 → 빈 문자열', () => {
    assert.equal(escape(''), '')
  })

  it('이미 escape 된 텍스트는 또 escape (&amp; → &amp;amp;)', () => {
    // 의도된 동작 — escape 는 idempotent X. 호출처가 raw input 만 통과시켜야.
    assert.equal(escape('&amp;'), '&amp;amp;')
  })

  it('한국어 + 특수문자 혼합', () => {
    assert.equal(escape('파머스테일 <hello>'), '파머스테일 &lt;hello&gt;')
  })

  it('숫자/undefined-like 입력도 string 변환 후 escape', () => {
    // String(123) → '123', 그대로 반환.
    // @ts-expect-error — 의도적 invalid 타입 입력 검증.
    assert.equal(escape(123), '123')
  })
})
