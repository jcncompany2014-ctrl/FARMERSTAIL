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

describe('renderMarkdown — 매거진 읽기 좋은 모양(2026-10-11)', () => {
  it('목록 뒤 문단은 따로 <p> 가 된다(목록이 다음 문단을 삼키지 않는다)', () => {
    const out = renderMarkdown('- 하나\n- 둘\n\n그다음 문단')
    assert.match(out, /<\/ul>\s*<p>그다음 문단<\/p>/)
    const ol = renderMarkdown('1. 첫째\n2. 둘째\n\n그다음 문단')
    assert.match(ol, /<ol><li>첫째<\/li><li>둘째<\/li><\/ol>\s*<p>그다음 문단<\/p>/)
  })

  it('표 — 머리 줄 + 구분 줄 + 칸(굵게 유지)', () => {
    const out = renderMarkdown('| 방식 | 하루 양 |\n|---|---|\n| 반반 | **126g** |')
    assert.match(out, /<table><thead><tr><th>방식<\/th><th>하루 양<\/th><\/tr><\/thead><tbody><tr><td>반반<\/td><td><strong>126g<\/strong><\/td><\/tr><\/tbody><\/table>/)
  })

  it('형광펜 ==강조==', () => {
    assert.match(renderMarkdown('화식이 ==새로워서==예요'), /<mark>새로워서<\/mark>/)
  })

  it('상자 — 요약·팁·주의(제목 없으면 기본 제목), 안쪽도 마크다운', () => {
    const sum = renderMarkdown(':::요약 세 줄 요약\n- **일주일**에 걸쳐\n- 하루 양\n:::')
    assert.match(sum, /<aside class="md-box md-sum"><p class="md-box-t">세 줄 요약<\/p><ul><li><strong>일주일<\/strong>에 걸쳐<\/li><li>하루 양<\/li><\/ul>/)
    assert.match(renderMarkdown(':::주의\n수의사와 먼저\n:::'), /<aside class="md-box md-warn"><p class="md-box-t">이럴 땐 수의사와 먼저<\/p><p>수의사와 먼저<\/p><\/aside>/)
    assert.match(renderMarkdown(':::팁\n알아 두기\n:::'), /md-tip/)
  })

  it('질문 칸 — 펼쳐 보는 details, 제목은 이스케이프', () => {
    const out = renderMarkdown(':::질문 <b>화식만</b> 먹여야 하나요?\n아니요.\n:::')
    assert.match(out, /<details class="md-qa"><summary>/)
    assert.match(out, /&lt;b&gt;화식만&lt;\/b&gt; 먹여야 하나요\?/)
    assert.match(out, /<div class="md-a"><p>아니요.<\/p><\/div><\/details>/)
  })

  it('상자 안의 위험한 HTML 도 이스케이프된다', () => {
    const out = renderMarkdown(':::팁\n<script>alert(1)</script>\n:::')
    assert.doesNotMatch(out, /<script>/)
  })

  it('닫히지 않은 상자는 글자 그대로(조용히 사라지지 않는다)', () => {
    assert.match(renderMarkdown(':::팁\n닫는 줄이 없다'), /:::팁/)
  })
})
