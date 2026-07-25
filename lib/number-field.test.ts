import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayValue, parseTyped } from './number-field.ts'

/**
 * 사장님 제보(2026-07-26): "원래 20 이라고 쓰여져 있던 숫자를 지우고 150 으로
 * 만들고 싶은데 앞에 늘 0 이 붙어. 저 0 은 지워지지도 않고."
 *
 * 아래 시나리오가 그 상황이다. 이 테스트가 깨지면 같은 버그가 돌아온 것.
 */

/** 컴포넌트가 하는 일을 그대로 재현 — raw 보관 + parseTyped 결과 반영. */
function makeField(initial: number | null, emptyAs: number | null = null) {
  let outer: number | null = initial
  let raw: string | null = null
  return {
    shown: () => displayValue(raw, outer),
    get value() {
      return outer
    },
    type(text: string) {
      raw = text
      const next = parseTyped(text, emptyAs)
      // undefined = 입력 도중(숫자 아님) → 바깥 값 유지
      if (next !== undefined) outer = next
    },
    blur() {
      raw = null
    },
  }
}

test('★ 20 을 지우면 칸이 비어야 한다 (0 이 다시 박히면 실패)', () => {
  const f = makeField(20, 0)
  assert.equal(f.shown(), '20')
  f.type('') // 전체 선택 후 삭제
  assert.equal(f.shown(), '')
})

test('★ 지우고 150 을 치면 150 — 앞에 0 이 붙지 않는다', () => {
  const f = makeField(20, 0)
  f.type('')
  f.type('1')
  f.type('15')
  f.type('150')
  assert.equal(f.shown(), '150')
  assert.equal(f.value, 150)
})

test('필수 항목: 비운 채로 포커스가 빠지면 0 으로 확정', () => {
  const f = makeField(20, 0)
  f.type('')
  f.blur()
  assert.equal(f.shown(), '0')
  assert.equal(f.value, 0)
})

test('선택 항목: 비우면 미입력(null) 로 저장된다', () => {
  const f = makeField(3000, null)
  f.type('')
  assert.equal(f.value, null)
  f.blur()
  assert.equal(f.shown(), '')
})

test('입력 도중 숫자가 아닌 상태는 바깥 값을 망가뜨리지 않는다', () => {
  const f = makeField(20, 0)
  f.type('-')
  assert.equal(f.value, 20, 'NaN 이 폼으로 새면 실패')
  assert.equal(f.shown(), '-', '화면은 사용자가 친 그대로')
  f.type('-5')
  assert.equal(f.value, -5)
})

test('소수점 입력 중간 상태(1.)도 값을 깨지 않는다', () => {
  const f = makeField(1, 0)
  f.type('1.')
  // Number('1.') === 1 이라 값은 1 유지, 화면은 '1.' 그대로여야 계속 칠 수 있다
  assert.equal(f.value, 1)
  assert.equal(f.shown(), '1.')
  f.type('1.5')
  assert.equal(f.value, 1.5)
})

test('바깥 값이 null 이면 빈 칸으로 보인다', () => {
  assert.equal(displayValue(null, null), '')
  assert.equal(displayValue(null, undefined), '')
  assert.equal(displayValue(null, 0), '0')
})

test('parseTyped 계약', () => {
  assert.equal(parseTyped('', 0), 0)
  assert.equal(parseTyped('', null), null)
  assert.equal(parseTyped('150', 0), 150)
  assert.equal(parseTyped('-', 0), undefined)
  assert.equal(parseTyped('abc', 0), undefined)
})
