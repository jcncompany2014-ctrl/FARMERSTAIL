/**
 * markdown.ts unit tests — Node native test runner.
 *
 * 핵심 회귀: 본문에 자연스럽게 등장하는 "CODE0"/"CODEBLOCK10" 같은 텍스트가
 * 내부 코드 자리표시자와 충돌해 깨지던 버그(쿠폰코드 안내 글 등). 더불어
 * 정상 마크다운 렌더 + XSS escape 가 유지되는지 확인.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from './markdown.ts'

const NUL = String.fromCharCode(0)

describe('renderMarkdown — null/empty', () => {
  it('null/undefined/empty → 빈 문자열', () => {
    assert.equal(renderMarkdown(null), '')
    assert.equal(renderMarkdown(undefined), '')
    assert.equal(renderMarkdown(''), '')
  })
})

describe('renderMarkdown — 자리표시자 충돌 회귀', () => {
  it('평문 "CODE0" 는 그대로 보존된다', () => {
    const out = renderMarkdown('쿠폰 코드 CODE0 을 입력하세요')
    assert.match(out, /CODE0/)
    assert.doesNotMatch(out, /undefined/)
  })

  it('평문 "CODE10" (여러 자리 숫자) 보존', () => {
    const out = renderMarkdown('할인코드 CODE10 사용')
    assert.match(out, /CODE10/)
    assert.doesNotMatch(out, /undefined/)
  })

  it('평문 "CODEBLOCK0" 보존', () => {
    const out = renderMarkdown('변수명 CODEBLOCK0 참고')
    assert.match(out, /CODEBLOCK0/)
    assert.doesNotMatch(out, /undefined/)
  })

  it('인라인 코드와 평문 CODE0 가 같은 문서에 있어도 각각 올바르게 처리', () => {
    const out = renderMarkdown('`const x = 5` 그리고 CODE0 텍스트')
    // 인라인 코드는 <code> 로
    assert.match(out, /<code>const x = 5<\/code>/)
    // 평문 CODE0 는 보존
    assert.match(out, /CODE0/)
    assert.doesNotMatch(out, /undefined/)
  })

  it('펜스 코드 블록 본문에 "CODE0" 가 들어가도 보존', () => {
    const md = '```\nCODE0\n```'
    const out = renderMarkdown(md)
    assert.match(out, /<pre><code>/)
    assert.match(out, /CODE0/)
    assert.doesNotMatch(out, /undefined/)
  })

  it('출력에 sentinel(NUL) 이 절대 남지 않는다', () => {
    const samples = [
      '쿠폰 CODE0 / CODE1 / CODEBLOCK0',
      '`inline` and ```\nblock\n``` and CODE5',
      'plain CODE99 text',
    ]
    for (const md of samples) {
      assert.equal(renderMarkdown(md).includes(NUL), false)
    }
  })

  it('악의로 NUL 이 본문에 들어와도 안전(자리표시자 위조 불가)', () => {
    const md = `evil ${NUL}CB0${NUL} text`
    const out = renderMarkdown(md)
    assert.equal(out.includes(NUL), false)
    // 위조 토큰이 코드로 복원되지 않아야 함
    assert.doesNotMatch(out, /<pre><code>/)
  })
})

describe('renderMarkdown — 정상 렌더 (회귀 가드)', () => {
  it('인라인 코드', () => {
    assert.match(renderMarkdown('`x`'), /<code>x<\/code>/)
  })

  it('펜스 코드 블록', () => {
    assert.match(renderMarkdown('```\nhello\n```'), /<pre><code>hello\n<\/code><\/pre>/)
  })

  it('헤더', () => {
    assert.match(renderMarkdown('# 제목'), /<h1>제목<\/h1>/)
  })

  it('bold / italic', () => {
    assert.match(renderMarkdown('**굵게**'), /<strong>굵게<\/strong>/)
    assert.match(renderMarkdown('*기울임*'), /<em>기울임<\/em>/)
  })

  it('안전한 링크는 렌더, 위험 스킴은 평문 유지', () => {
    assert.match(renderMarkdown('[네이버](https://naver.com)'), /<a href="https:\/\/naver\.com"/)
    // javascript: 스킴은 safeUrl 통과 못 함 → 원문 그대로
    const out = renderMarkdown('[x](javascript:alert(1))')
    assert.doesNotMatch(out, /<a /)
  })

  it('XSS: 원시 HTML 은 escape', () => {
    const out = renderMarkdown('<script>alert(1)</script>')
    assert.doesNotMatch(out, /<script>/)
    assert.match(out, /&lt;script&gt;/)
  })
})
