/**
 * 가벼운 마크다운 → HTML 렌더러.
 *
 * 새 npm 의존성을 추가하지 않으려고 직접 작성. 안전성 위해 입력은 먼저
 * HTML escape 후 마크다운 패턴만 다시 태그로 교체. 외부 사용자 입력이 아닌
 * admin 이 작성한 본문에만 쓰는 걸 전제 — admin 이 신뢰할 수 있는 source
 * 라는 가정.
 *
 * 지원 syntax:
 *   - 헤더 # / ## / ###
 *   - **bold**, *italic*
 *   - `inline code`, ```fenced code```
 *   - [text](url) 링크 — http(s)/mailto/상대경로만 허용 (xss 방지)
 *   - ![alt](url) 이미지 — 동일하게 url 검증
 *   - - 또는 * 시작하는 리스트
 *   - > 인용
 *   - ---  hr
 *   - 빈 줄로 단락 구분, 단락 내 \\n 은 <br>
 *   - `::레시피 오리` 한 줄(앞뒤 빈 줄) — 매거진 레시피 카드 자리. 여기선 이름표 div 만 만들고,
 *     글 화면(app/blog/[slug])이 lib/magazine/recipe-card 로 가게 상품 카드로 바꾼다. 모르는 이름은 글자 그대로.
 *
 * 매거진 읽기 좋은 모양(2026-10-11 사장님 "본문을 더 가시성 좋게") — 모양은 lib/magazine/post-css:
 *   - `1. ` 로 시작하는 줄들 → 번호 목록(글 화면에선 단계 표시)
 *   - `| 칸 | 칸 |` 표(둘째 줄 `|---|---|`) → 표
 *   - `==강조==` → 형광펜
 *   - 상자 — 줄 맨 앞 `:::요약`·`:::팁`·`:::주의`(뒤에 제목을 쓰면 그 제목) … 닫는 줄 `:::`.
 *     `:::질문 화식만 먹여야 하나요?` … `:::` → 펼쳐 보는 질문 칸. 상자 안도 같은 마크다운이다.
 */
import { RECIPE_BLOCK_LABEL, recipeBlockKey } from './magazine/recipe-block.ts'

const RECIPE_BLOCK_RE = /^::레시피\s+(\S+)$/

/** 상자 — 줄 맨 앞 `:::종류 [제목]` 부터 홀로 선 `:::` 까지. 안쪽은 같은 렌더러로 다시 그린다. */
const BOX_RE = /^:::(요약|팁|주의|질문)[ \t]*([^\n]*)\n([\s\S]*?)\n:::[ \t]*$/gm
const BOX_TITLE: Record<'요약' | '팁' | '주의', { cls: string; title: string }> = {
  요약: { cls: 'md-sum', title: '한눈에 보기' },
  팁: { cls: 'md-tip', title: '알아 두면 좋아요' },
  주의: { cls: 'md-warn', title: '이럴 땐 수의사와 먼저' },
}

/** `| a | b |` 줄들(둘째 줄이 `|---|`)을 표로. 칸 안 글은 이미 이스케이프·굵게 처리된 상태다. */
function renderTable(chunk: string): string | null {
  const lines = chunk.split('\n').map((l) => l.trim())
  if (lines.length < 2 || !lines.every((l) => l.startsWith('|') && l.endsWith('|'))) return null
  if (!/^\|(\s*:?-{3,}:?\s*\|)+$/.test(lines[1] ?? '')) return null
  const cells = (l: string) => l.slice(1, -1).split('|').map((c) => c.trim())
  const head = cells(lines[0] ?? '')
  const rows = lines.slice(2).map(cells)
  return (
    `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  )
}

const URL_RE =
  /^(https?:\/\/|mailto:|\/[^\/]|#[A-Za-z0-9_-]+)/i

// 코드 자리표시자를 감싸는 sentinel. 예전엔 `CODE0`/`CODEBLOCK0` 같은 평문
// 토큰을 썼는데, 본문에 자연스럽게 등장하는 "CODE10"(쿠폰코드 안내 등) 텍스트가
// 복원 단계 정규식에 걸려 엉뚱한 코드로 치환되거나 undefined 로 깨졌다. NUL 은
// 마크다운 본문에 등장하지 않고, 복원 후 남은 것은 전부 제거하므로 출력엔 없다.
const SENT = String.fromCharCode(0)

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeUrl(u: string): string | null {
  const t = u.trim()
  if (!URL_RE.test(t)) return null
  return t
}

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return ''
  let s = md.replace(/\r\n?/g, '\n')
  // sentinel 이 본문에 우연히 들어오면 자리표시자 충돌이 나므로 먼저 제거.
  s = s.split(SENT).join('')

  // 0) 상자(:::요약·팁·주의·질문) — 안쪽을 따로 그려 자리표시자로 빼 둔다(코드 블록과 같은 방식).
  const boxes: string[] = []
  s = s.replace(BOX_RE, (_m, kind: '요약' | '팁' | '주의' | '질문', arg: string, inner: string) => {
    const title = escapeHtml(arg.trim())
    const body = renderMarkdown(inner)
    boxes.push(
      kind === '질문'
        ? `<details class="md-qa"><summary><span class="md-q" aria-hidden="true">Q</span><span class="md-qt">${title}</span><span class="md-qa-i" aria-hidden="true"></span></summary><div class="md-a">${body}</div></details>`
        : `<aside class="md-box ${BOX_TITLE[kind].cls}"><p class="md-box-t">${title || BOX_TITLE[kind].title}</p>${body}</aside>`,
    )
    return `\n\n${SENT}BX${boxes.length - 1}${SENT}\n\n`
  })

  // 1) Fenced code blocks (```...```) — 먼저 처리해 내부에서 다른 패턴이 안 잡히게.
  const codeBlocks: string[] = []
  s = s.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_m, _lang, body) => {
    codeBlocks.push(escapeHtml(body))
    return `${SENT}CB${codeBlocks.length - 1}${SENT}`
  })

  // 2) inline code (`...`) — 내부 마크다운 무력화.
  const inlineCodes: string[] = []
  s = s.replace(/`([^`\n]+?)`/g, (_m, body) => {
    inlineCodes.push(escapeHtml(body))
    return `${SENT}CI${inlineCodes.length - 1}${SENT}`
  })

  // 3) escape 나머지 HTML
  s = escapeHtml(s)

  // 4) 헤더
  s = s.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  s = s.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 5) hr
  s = s.replace(/^---$/gm, '<hr>')

  // 6) 인용
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // 7) 이미지 ![alt](url) — 안전한 url 만
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
    const safe = safeUrl(url)
    if (!safe) return _m
    return `<img src="${safe}" alt="${alt}" loading="lazy" />`
  })

  // 8) 링크 [text](url) — 안전 url 만
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    const safe = safeUrl(url)
    if (!safe) return _m
    const ext = /^https?:\/\//.test(safe)
    return `<a href="${safe}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
  })

  // 9) bold / italic (*) — italic 이 너무 광범위해서 단어경계 강제
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  // 9-1) 형광펜 ==강조==
  s = s.replace(/==([^=\n]+?)==/g, '<mark>$1</mark>')

  // 10) 리스트 — 연속된 - / * 시작 줄을 <ul> 로 묶음
  s = s.replace(/(^|\n)((?:[-*] [^\n]+\n?)+)/g, (_m, prefix: string, block: string) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => line.replace(/^[-*] /, ''))
      .map((line) => `<li>${line}</li>`)
      .join('')
    // 뒤에 빈 줄 — 목록이 마지막 줄바꿈을 먹어 다음 문단이 같은 칸에 붙고 <p> 를 못 얻던 것(2026-10-11 매거진 시안에서 발견).
    return `${prefix}<ul>${items}</ul>\n\n`
  })
  // 10-1) 번호 목록 — 연속된 `1. ` 줄을 <ol> 로
  s = s.replace(/(^|\n)((?:\d+\. [^\n]+\n?)+)/g, (_m, prefix: string, block: string) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
      .join('')
    return `${prefix}<ol>${items}</ol>\n\n`
  })

  // 11) 단락 — 빈 줄로 구분된 chunk 를 <p> 로. 이미 블록 태그면 그대로.
  s = s
    .split(/\n{2,}/)
    .map((chunk) => {
      const t = chunk.trim()
      if (!t) return ''
      const rb = RECIPE_BLOCK_RE.exec(t)
      const recipe = rb ? recipeBlockKey(rb[1] ?? '') : null
      if (recipe) return `<div class="md-recipe" data-recipe="${recipe}">레시피 카드 — ${RECIPE_BLOCK_LABEL[recipe]}</div>`
      if (new RegExp(`^${SENT}BX\\d+${SENT}$`).test(t)) return t
      const table = renderTable(t)
      if (table) return table
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|p|img|figure|table)/.test(t)) return t
      // 단일 line break 는 <br>
      return `<p>${t.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  // 12) 코드 블록 / 인라인 코드 복원 (sentinel 로 감싼 토큰만 매칭)
  const blockRe = new RegExp(`${SENT}CB(\\d+)${SENT}`, 'g')
  s = s.replace(blockRe, (_m, idx: string) => {
    return `<pre><code>${codeBlocks[Number(idx)] ?? ''}</code></pre>`
  })
  const inlineRe = new RegExp(`${SENT}CI(\\d+)${SENT}`, 'g')
  s = s.replace(inlineRe, (_m, idx: string) => {
    return `<code>${inlineCodes[Number(idx)] ?? ''}</code>`
  })

  const boxRe = new RegExp(`${SENT}BX(\\d+)${SENT}`, 'g')
  s = s.replace(boxRe, (_m, idx: string) => boxes[Number(idx)] ?? '')

  // 안전망: 복원되지 않은 sentinel 이 남았다면 출력에서 제거(가시 깨짐 방지).
  s = s.split(SENT).join('')

  return s
}
