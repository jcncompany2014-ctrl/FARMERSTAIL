import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/seo/jsonld'

/**
 * /rss.xml — 매거진 글 RSS 2.0(네이버 서치어드바이저 'RSS 제출'용).
 *
 * 2026-10-21 사장님 "네이버 서치 어드바이저 최적화": 네이버는 새 글을 RSS 로 가장 빨리 가져간다. 사이트맵만 있고 RSS 는
 * 없어서(404) 매거진 글이 네이버에 늦게 잡혔다. 글 목록 = 사이트맵과 같은 기준(공개 글 전부, 게시일 최신순).
 * 조회가 실패하면 빈 피드가 아니라 503 을 준다 — 빈 피드를 주면 네이버가 '글이 없어졌다'로 읽는다(AGENTS 규칙1).
 */
export const revalidate = 3600

const MAX_ITEMS = 50

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, excerpt, published_at, updated_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(MAX_ITEMS)
  if (error) {
    console.error('[rss] blog_posts 조회 실패', error.message)
    return new Response('RSS 를 잠시 만들 수 없어요', { status: 503, headers: { 'Retry-After': '600' } })
  }

  const posts = data ?? []
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`
      const date = p.published_at ?? p.updated_at
      return [
        '    <item>',
        `      <title>${esc(p.title ?? '')}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        p.excerpt ? `      <description>${esc(p.excerpt)}</description>` : '',
        date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const latest = posts[0]?.published_at ?? posts[0]?.updated_at
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>파머스테일 매거진</title>',
    `    <link>${SITE_URL}/blog</link>`,
    '    <description>강아지 화식을 처음 시작할 때 궁금한 것들 — 파머스테일 매거진</description>',
    '    <language>ko</language>',
    `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
    latest ? `    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>` : '',
    items,
    '  </channel>',
    '</rss>',
  ]
    .filter(Boolean)
    .join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
