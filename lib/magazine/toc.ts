/**
 * 매거진 '이 글의 순서'(목차) — 본문 HTML 의 소제목(h2)에 이동용 id 를 달고, 소제목이 3개 이상이면 목차를 넣는다
 * (2026-10-11 사장님 "본문을 더 가시성 좋게"). 맨 앞이 요약 상자(:::요약)면 그 바로 뒤, 아니면 맨 앞에.
 * 번호는 글 화면 CSS(소제목 번호 counter)와 같은 순서 — 01, 02 …
 */
/**
 * 소제목 앞에 손으로 쓴 번호("1. "·"2) ") — 화면 CSS 가 01·02 를 달아서 "02 / 1. 닭 가슴살 저키"처럼 번호가 두 번
 * 찍혔다(2026-10-12 점검: 옛 글 '수제 간식 5가지'). 번호는 CSS 하나로 — 소제목의 손 번호는 뗀다.
 */
const MANUAL_HEADING_NUM = /^\s*\d{1,2}[.)]\s+/

export function withToc(html: string): { html: string; count: number } {
  const items: { id: string; text: string }[] = []
  const withIds = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, raw: string) => {
    const inner = raw.replace(MANUAL_HEADING_NUM, '')
    const id = `s${items.length + 1}`
    items.push({ id, text: inner.replace(/<[^>]+>/g, '') })
    return `<h2 id="${id}">${inner}</h2>`
  })
  if (items.length < 3) return { html: withIds, count: items.length }
  const toc =
    `<nav class="md-toc" aria-label="이 글의 순서"><p class="md-box-t">이 글의 순서</p><ol>` +
    items.map((t, i) => `<li><a href="#${t.id}"><span>${String(i + 1).padStart(2, '0')}</span>${t.text}</a></li>`).join('') +
    `</ol></nav>`
  const SUM_END = '</aside>'
  const out =
    withIds.trimStart().startsWith('<aside class="md-box md-sum">') && withIds.includes(SUM_END)
      ? withIds.replace(SUM_END, SUM_END + toc)
      : toc + withIds
  return { html: out, count: items.length }
}
