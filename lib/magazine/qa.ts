/**
 * 매거진 본문의 ':::질문 물음 / 답 / :::' 상자 → 구조화 데이터(FAQPage)용 문답.
 *
 * 2026-10-11 SEO·GEO(사장님 "seo geo 최적화"): 글 끝 '자주 묻는 것'을 검색엔진·AI 가 문답으로 읽게 한다
 * (AI 검색은 물음-답 짝을 그대로 인용하기 좋아한다). 상자 문법은 lib/markdown 의 BOX_RE 와 같다 —
 * 첫 줄 = 물음, 닫는 ':::' 까지 = 답. 답 속 마크다운 꾸밈(링크·굵게·형광펜)은 걷어 내고 글자만 남긴다.
 */
export type MagazineQa = { question: string; answer: string }

const QA_RE = /^:::질문[ \t]+([^\n]+)\n([\s\S]*?)\n:::[ \t]*$/gm

function plain(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractQa(content: string): MagazineQa[] {
  const out: MagazineQa[] = []
  for (const m of content.replace(/\r\n/g, '\n').matchAll(QA_RE)) {
    const question = plain(m[1] ?? '')
    const answer = plain(m[2] ?? '')
    if (question && answer) out.push({ question, answer })
  }
  return out
}
