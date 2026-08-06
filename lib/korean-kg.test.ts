import test from 'node:test'
import assert from 'node:assert/strict'
import { formatKg } from './korean.ts'

/**
 * 몸무게 표기 정본 (2026-08-07 앱 화면 감사).
 * 예전엔 화면마다 "4kg" / "4 kg" / "4.0 kg" / "4.0kg으로 저장" 네 가지였다.
 */
test('formatKg — 정수는 소수점 없이', () => {
  assert.equal(formatKg(4), '4kg')
  assert.equal(formatKg(12), '12kg')
  assert.equal(formatKg(4.0), '4kg')
})

test('formatKg — 소수는 첫째 자리까지', () => {
  assert.equal(formatKg(4.5), '4.5kg')
  assert.equal(formatKg(3.25), '3.3kg')
  assert.equal(formatKg(3.24), '3.2kg')
})

test('formatKg — 값이 없으면 대시', () => {
  assert.equal(formatKg(null), '-')
  assert.equal(formatKg(undefined), '-')
  assert.equal(formatKg(Number.NaN), '-')
  assert.equal(formatKg(Number.POSITIVE_INFINITY), '-')
})

test('formatKg — 단위는 붙여쓴다 (공백 금지)', () => {
  // "4 kg" 처럼 띄어 쓰던 화면이 있었다.
  assert.ok(!formatKg(4).includes(' '))
  assert.ok(!formatKg(4.5).includes(' '))
})
