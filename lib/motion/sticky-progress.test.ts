import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stickyScreenIndex } from './sticky-progress.ts'

// 실제 값 — 607×814 화면, feature 6장(장당 620px): 트랙 4534, 스팬 3720.
const H = 814
const TRACK = 4534
const N = 6
const SPAN = TRACK - H

test('트랙을 6등분하면 화면이 0→5 로 순서대로 넘어간다', () => {
  const got = [0, 1, 2, 3, 4, 5].map((i) =>
    stickyScreenIndex(-(SPAN * (i / 6) + 10), TRACK, H, N),
  )
  assert.deepEqual(got, [0, 1, 2, 3, 4, 5])
})

test('경계 — 시작 전과 끝 이후는 첫/마지막 화면에 머문다', () => {
  assert.equal(stickyScreenIndex(500, TRACK, H, N), 0, '아직 트랙에 안 들어옴')
  assert.equal(stickyScreenIndex(0, TRACK, H, N), 0, '트랙 상단에 막 닿음')
  assert.equal(stickyScreenIndex(-SPAN, TRACK, H, N), N - 1, '트랙 끝')
  assert.equal(stickyScreenIndex(-SPAN * 3, TRACK, H, N), N - 1, '지나쳐도 마지막')
})

test('마지막 화면이 한 구간을 온전히 차지한다(끝에서만 잠깐 뜨지 않는다)', () => {
  // 5/6 지점부터 끝까지가 전부 마지막 화면이어야 한다.
  for (const f of [5 / 6 + 0.001, 0.9, 0.99, 1]) {
    assert.equal(stickyScreenIndex(-SPAN * f, TRACK, H, N), N - 1, `f=${f}`)
  }
  // 그 직전은 아직 4번.
  assert.equal(stickyScreenIndex(-SPAN * (5 / 6 - 0.001), TRACK, H, N), 4)
})

test('계산 불가는 0 — 화면이 없다고 하지 않는다', () => {
  assert.equal(stickyScreenIndex(-100, 400, 800, N), 0, '트랙이 뷰포트보다 짧음')
  assert.equal(stickyScreenIndex(-100, 800, 800, N), 0, '스팬 0')
  assert.equal(stickyScreenIndex(-100, TRACK, H, 0), 0, '화면 수 0')
})

test('★화면 크기가 달라져도 같은 비율에서 같은 화면 — 리사이즈로 안 어긋난다', () => {
  // 폰(375×812)과 태블릿(607×814)은 트랙 높이가 같다(620px × N 고정).
  for (const vh of [667, 812, 814, 1024]) {
    const span = TRACK - vh
    const got = [0, 1, 2, 3, 4, 5].map((i) =>
      stickyScreenIndex(-(span * (i / 6) + 1), TRACK, vh, N),
    )
    assert.deepEqual(got, [0, 1, 2, 3, 4, 5], `vh=${vh}`)
  }
})
