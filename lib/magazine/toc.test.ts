import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withToc } from './toc.ts'

test('매거진 목차 — 소제목 3개 이상이면 목차, 이동용 id', () => {
  const { html, count } = withToc('<h2>하나</h2><p>a</p><h2>둘</h2><p>b</p><h2>셋</h2>')
  assert.equal(count, 3)
  assert.match(html, /<nav class="md-toc"/)
  assert.match(html, /<h2 id="s1">하나<\/h2>/)
  assert.match(html, /<a href="#s3"><span>03<\/span>셋<\/a>/)
})

test('매거진 목차 — 소제목의 손 번호("1. ")는 뗀다(화면 CSS 번호와 겹쳐 "02 / 1." 이 됐다, 2026-10-12)', () => {
  const { html } = withToc('<h2>재료 준비</h2><h2>1. 닭 가슴살 저키 (30분)</h2><h2>2) 단호박 큐브</h2><h2>2026년 계획</h2>')
  assert.match(html, /<h2 id="s2">닭 가슴살 저키 \(30분\)<\/h2>/)
  assert.match(html, /<span>02<\/span>닭 가슴살 저키 \(30분\)/)
  assert.match(html, /<h2 id="s3">단호박 큐브<\/h2>/)
  // 연도처럼 번호가 아닌 숫자는 그대로
  assert.match(html, /<h2 id="s4">2026년 계획<\/h2>/)
  assert.ok(!/<span>0\d<\/span>\d+[.)]/.test(html), '목차에 손 번호가 남았다')
})
