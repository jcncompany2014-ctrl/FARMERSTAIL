/**
 * 메일 HTML → 글자판(text/plain) — 모든 메일의 두 번째 판이다(lib/email/client sendEmail 이 text 를 안 넘기면 이걸 쓴다).
 *
 * # 왜 따로 만들었나 (2026-10-14 메일 점검 M1, 규칙236)
 * 예전 변환(client.ts stripHtml)은 태그를 통째로 지웠다 — <a href="X">정기배송 관리하기</a> 가 '정기배송 관리하기' 한 줄만
 * 남아, 글자판으로 읽는 메일 앱(아웃룩 일반 텍스트 모드·스마트워치·화면 낭독기·스팸 필터의 글자판 검사)에는
 * **버튼 주소가 한 개도 없었다**. 그리고 엔티티는 &amp;·&lt;·&gt;·&nbsp; 넷만 되돌려 escape 가 만든 &#39;·&quot; 가 그대로 남았다
 * ("Farmer&#39;s Tail").
 *
 * # 무엇을 하나
 *   · 링크 <a href="X">글</a> → '글 (X)'. 글과 주소가 같으면 주소만, mailto 는 주소만.
 *   · 그림은 대체 글자(alt)로 — 머리 로고 링크가 'Farmer's Tail 파머스테일 (https://…)' 한 줄이 된다.
 *   · 엔티티는 숫자(&#39; · &#x27;)와 이름(&quot; · &nbsp; …) 모두 한 번에 되돌린다(두 번 되돌리지 않게 한 번에).
 *   · 줄바꿈 — HTML 의 공백·줄바꿈은 의미가 없으니 먼저 한 칸으로 접고, 블록(문단·행·제목·<br>)에서만 줄을 바꾼다.
 *     white-space:pre 계열 칸(문의 본문)은 원래 줄바꿈을 지킨다.
 *   · 받은편지함 미리보기 줄(display:none)과 <head>(제목 중복)는 뺀다.
 *
 * 외부 모듈을 부르지 않는다 — 단위 시험(node --experimental-strip-types)에서 바로 읽힌다.
 */

/** 메일에 나올 수 있는 이름 엔티티. 여기 없는 이름은 그대로 둔다(글자 그대로의 '&이름;' 일 수 있다). */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  rarr: '→',
  larr: '←',
  times: '×',
  copy: '©',
  reg: '®',
  trade: '™',
  zwnj: '',
  zwj: '',
}

/** HTML 엔티티를 한 번에 되돌린다 — 숫자(10진·16진)는 전부, 이름은 위 표에 있는 것. */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const cp = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return ''
      return String.fromCodePoint(cp)
    }
    const v = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()]
    return v ?? whole
  })
}

/** 속성 값 하나(큰따옴표·작은따옴표). 엔티티는 그대로 — 되돌리기는 맨 끝에 한 번. */
function attr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = re.exec(attrs)
  return m ? (m[1] ?? m[2] ?? '') : null
}

/** 공백 접기 — 비교용(되돌린 글자 기준). */
function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** <a> 한 개 → 글자. 반환값은 아직 엔티티가 남은 원문(맨 끝에서 한 번에 되돌린다). */
function linkToText(attrs: string, inner: string): string {
  const hrefRaw = (attr(attrs, 'href') ?? '').trim()
  const labelRaw = squash(inner.replace(/<[^>]+>/g, ' '))
  const href = decodeHtmlEntities(hrefRaw)
  const label = squash(decodeHtmlEntities(labelRaw))
  if (!hrefRaw || href.startsWith('#') || /^javascript:/i.test(href)) return labelRaw
  if (/^mailto:/i.test(href)) {
    const addrRaw = hrefRaw.replace(/^mailto:/i, '').split('?')[0] ?? ''
    const addr = decodeHtmlEntities(addrRaw)
    return !label || label === addr ? addrRaw : `${labelRaw} (${addrRaw})`
  }
  if (!label) return hrefRaw
  if (label === href || label === href.replace(/^https?:\/\//i, '')) return hrefRaw
  return `${labelRaw} (${hrefRaw})`
}

/** 원래 줄바꿈을 지켜야 하는 칸(white-space:pre·pre-wrap·pre-line) 안의 줄바꿈 표식. */
const KEEP_NL = '\u0001'

/** HTML 메일 → 글자판. */
export function htmlToPlainText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<title\b[\s\S]*?<\/title>/gi, '')
    // 받은편지함 미리보기 줄(lib/email/layout 의 display:none 칸) — 본문에 이미 있는 말이다.
    .replace(/<(div|span)\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/\1>/gi, '')

  // 원래 줄바꿈을 지키는 칸 — 공백 접기 전에 줄바꿈을 표식으로 바꿔 둔다.
  s = s.replace(
    /<(div|p|td|span|pre)\b([^>]*white-space\s*:\s*pre[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_m, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner.replace(/\r?\n/g, KEEP_NL)}</${tag}>`,
  )
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => `\n${inner.replace(/\r?\n/g, KEEP_NL)}\n`)

  // HTML 의 공백·줄바꿈은 한 칸 — 줄은 아래 블록 규칙으로만 바꾼다.
  s = s.replace(/[ \t\r\n\f]+/g, ' ')

  // 그림 → 대체 글자.
  s = s.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    const alt = attr(attrs, 'alt')
    return alt ? ` ${alt} ` : ''
  })

  // 링크 → '글 (주소)'.
  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => linkToText(attrs, inner))

  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|h[1-6]|table|ul|ol|blockquote|pre)>/gi, '\n\n')
    .replace(/<(p|h[1-6]|table|ul|ol|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<\/(div|tr|li|section|header|footer)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .split(KEEP_NL)
    .join('\n')

  s = decodeHtmlEntities(s)
    // 미리보기 뒤를 채우는 보이지 않는 글자(조합 문자·폭 0 글자)와 줄바꿈 없는 공백.
    .replace(/[͏​‌‍⁠﻿]/g, '')
    .replace(/ /g, ' ')

  return s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
