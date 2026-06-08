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
 */

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

  // 10) 리스트 — 연속된 - / * 시작 줄을 <ul> 로 묶음
  s = s.replace(/(^|\n)((?:[-*] [^\n]+\n?)+)/g, (_m, prefix: string, block: string) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => line.replace(/^[-*] /, ''))
      .map((line) => `<li>${line}</li>`)
      .join('')
    return `${prefix}<ul>${items}</ul>`
  })

  // 11) 단락 — 빈 줄로 구분된 chunk 를 <p> 로. 이미 블록 태그면 그대로.
  s = s
    .split(/\n{2,}/)
    .map((chunk) => {
      const t = chunk.trim()
      if (!t) return ''
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|p|img|figure)/.test(t)) return t
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

  // 안전망: 복원되지 않은 sentinel 이 남았다면 출력에서 제거(가시 깨짐 방지).
  s = s.split(SENT).join('')

  return s
}
