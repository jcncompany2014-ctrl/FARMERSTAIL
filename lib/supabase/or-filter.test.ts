import test from 'node:test'
import assert from 'node:assert/strict'
import { safeOrTerm } from './or-filter.ts'

/**
 * safeOrTerm — .or() 주입 방어 + 검색 품질 (2026-08-08).
 *
 * ★첫 버전은 `.` 까지 지워서 **이메일 검색이 항상 0건**이었다
 * (`hello@x.com` → `hello@xcom`). CS 가 어드민 회원 검색에 이메일을
 * 붙여넣는 게 가장 흔한 동선인데, 그 검색이 조용히 "이 고객 없음"을
 * 돌려줬다. 이 파일이 그 회귀를 지킨다.
 */

test('★이메일이 그대로 살아남는다 (첫 버전이 깨뜨린 것)', () => {
  assert.equal(safeOrTerm('hello@x.com'), 'hello@x.com')
  // 언더스코어는 LIKE 와일드카드라 escape — 제거가 아니다.
  assert.equal(safeOrTerm('a_b@x.com'), 'a\\_b@x.com')
})

test('전화번호·주문번호도 살아남는다', () => {
  assert.equal(safeOrTerm('010-1234-5678'), '010-1234-5678')
  assert.equal(safeOrTerm('FT-20260808-0001'), 'FT-20260808-0001')
})

test('or() 문법 토큰은 제거된다 — 필터 절 주입 차단', () => {
  assert.equal(safeOrTerm('a),or(role.eq.admin'), 'aorrole.eq.admin')
  assert.ok(!safeOrTerm('x),or(id.not.is.null').includes(','))
  assert.ok(!safeOrTerm('x(y)z').includes('('))
  assert.ok(!safeOrTerm(`x"y'z\\w`).includes('"'))
})

test('LIKE 와일드카드는 escape 된다 (리터럴 매칭)', () => {
  assert.equal(safeOrTerm('50%'), '50\\%')
})

test('빈 결과 — 기호만 입력하면 빈 문자열 (호출부가 검색을 걸지 말아야)', () => {
  assert.equal(safeOrTerm('(),"'), '')
})

test('길이 상한', () => {
  assert.equal(safeOrTerm('a'.repeat(200)).length, 80)
})

test('상한 경계가 escape 쌍을 반 가르지 않는다 — 트레일링 \\ 금지', () => {
  // 79번째가 `%` 면: 자르기→escape 순서라 `\%` 가 통째로 살아남거나 통째로
  // 잘린다. escape→자르기 순서였다면 `...\` 로 끝나 뒤의 %와일드카드를 죽였다.
  const out = safeOrTerm('a'.repeat(79) + '%zzz')
  assert.ok(!out.endsWith('\\'), `트레일링 백슬래시: ${out.slice(-5)}`)
})
