/**
 * csv.ts unit tests — Node native runner.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv, toCsvBuffer } from './csv.ts'

describe('toCsv', () => {
  it('emits header-only when rows are empty', () => {
    const csv = toCsv([], ['a', 'b'])
    assert.equal(csv, 'a,b')
  })

  it('escapes commas, quotes, CR/LF inside fields', () => {
    const csv = toCsv(
      [{ note: 'hello, "friend"\nsecond line' }],
      ['note'],
    )
    // 쌍따옴표 한 번 → "" 두 번, 감싸는 따옴표는 한 쌍.
    assert.equal(csv, 'note\r\n"hello, ""friend""\nsecond line"')
  })

  it('passes through numbers and booleans as strings', () => {
    const csv = toCsv([{ qty: 3, live: true }], ['qty', 'live'])
    assert.equal(csv, 'qty,live\r\n3,true')
  })

  it('emits empty string for null / undefined', () => {
    const csv = toCsv(
      [{ a: null, b: undefined, c: 'x' }],
      ['a', 'b', 'c'],
    )
    assert.equal(csv, 'a,b,c\r\n,,x')
  })

  it('preserves column order from columns argument', () => {
    const csv = toCsv([{ c: 3, a: 1, b: 2 }], ['a', 'b', 'c'])
    assert.equal(csv, 'a,b,c\r\n1,2,3')
  })
})

describe('toCsvBuffer', () => {
  it('prepends UTF-8 BOM for Excel compatibility', () => {
    const buf = toCsvBuffer([{ name: '김철수' }], ['name'])
    assert.equal(buf[0], 0xef)
    assert.equal(buf[1], 0xbb)
    assert.equal(buf[2], 0xbf)
    const body = new TextDecoder().decode(buf.slice(3))
    assert.equal(body, 'name\r\n김철수')
  })
})
