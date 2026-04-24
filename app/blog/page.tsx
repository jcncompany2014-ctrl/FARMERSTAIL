import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PublicPageShell from '@/components/PublicPageShell'
import { ogImageUrl } from '@/lib/seo/jsonld'

/**
 * /blog — 매거진 인덱스.
 *
 * 톤: landing / /products와 연결되는 editorial 언어. kicker + serif 헤드라인
 * + paper-tone 카드 + hex → 토큰. Hero 1개 + 나머지 리스트 2-row 그리드.
 */

export const dynamic = 'force-dynamic'

const BLOG_OG = ogImageUrl({
  title: '매거진',
  subtitle: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
  tag: 'Magazine',
  variant: 'editorial',
})

export const metadata: Metadata = {
  title: '매거진 | 파머스테일',
  description: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: '매거진 | 파머스테일',
    description: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
    type: 'website',
    url: '/blog',
    images: [{ url: BLOG_OG, width: 1200, height: 630, alt: '파머스테일 매거진' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '매거진 | 파머스테일',
    description: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
    images: [BLOG_OG],
  },
  robots: { index: true, follow: true },
}

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  category_id: string | null
  published_at: string | null
  views: number | null
}

type Category = {
  id: string
  slug: string
  name: string
}

type SearchParams = Promise<{ category?: string }>

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { category: catSlug } = await searchParams
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('blog_categories')
    .select('id, slug, name')
    .order('sort_order', { ascending: true })
  const cats = (categories ?? []) as Category[]
  const activeCategory = catSlug ? cats.find((c) => c.slug === catSlug) : null

  let query = supabase
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, cover_url, category_id, published_at, views'
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (activeCategory) {
    query = query.eq('category_id', activeCategory.id)
  }

  const { data: posts } = await query
  const rows = (posts ?? []) as Post[]
  const catById = new Map(cats.map((c) => [c.id, c]))

  const [hero, ...rest] = rows

  return (
    <PublicPageShell>
      {/* ── Hero title ──────────────────────────────────── */}
      <section className="px-5 pt-10 pb-5 text-center">
        <span className="kicker">Magazine · 매거진</span>
        <h1
          className="font-serif mt-3 leading-tight"
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          파머스테일 매거진
        </h1>
        <p
          className="mx-auto mt-3 text-[12px] leading-relaxed max-w-[280px]"
          style={{ color: 'var(--muted)' }}
        >
          반려견 영양·건강·케어에 관한 파머스테일의 이야기
        </p>
      </section>

      {/* ── Chapter nav · 카테고리 ─────────────────────── */}
      <section className="px-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">Chapters · 카테고리</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <nav className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Link
            href="/blog"
            className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition"
            style={{
              background: !activeCategory ? 'var(--ink)' : 'var(--bg-2)',
              color: !activeCategory ? 'var(--bg)' : 'var(--text)',
              boxShadow: !activeCategory
                ? '0 4px 14px rgba(30,26,20,0.18)'
                : 'inset 0 0 0 1px var(--rule)',
            }}
          >
            전체
          </Link>
          {cats.map((c) => {
            const active = activeCategory?.id === c.id
            return (
              <Link
                key={c.id}
                href={`/blog?category=${c.slug}`}
                className="shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition"
                style={{
                  background: active ? 'var(--ink)' : 'var(--bg-2)',
                  color: active ? 'var(--bg)' : 'var(--text)',
                  boxShadow: active
                    ? '0 4px 14px rgba(30,26,20,0.18)'
                    : 'inset 0 0 0 1px var(--rule)',
                }}
              >
                {c.name}
              </Link>
            )
          })}
        </nav>
      </section>

      {rows.length === 0 ? (
        /* Empty — editorial paper-tone */
        <div className="px-5 mt-6 pb-10">
          <div
            className="rounded-2xl py-14 flex flex-col items-center text-center"
            style={{
              background: 'var(--bg-2)',
              border: '1px dashed var(--rule-2)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'var(--bg)' }}
            >
              <BookOpen
                className="w-5 h-5"
                strokeWidth={1.8}
                color="var(--muted)"
              />
            </div>
            <span className="kicker kicker-muted">Coming Soon · 준비 중</span>
            <p
              className="font-serif mt-2 text-[15px] font-black"
              style={{ color: 'var(--text)' }}
            >
              아직 게시된 글이 없어요
            </p>
            <p
              className="text-[11px] mt-1.5"
              style={{ color: 'var(--muted)' }}
            >
              {activeCategory
                ? `"${activeCategory.name}" 카테고리는 준비 중이에요`
                : '곧 첫 번째 이야기를 만나보세요.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="pb-10">
          {/* ── Hero (최신 글) ──────────────────────── */}
          {hero && (
            <section className="px-5 mt-7">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="kicker"
                  style={{ color: 'var(--terracotta)' }}
                >
                  Latest · 최신 글
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: 'var(--rule-2)' }}
                />
              </div>

              <Link href={`/blog/${hero.slug}`} className="block group">
                <article
                  className="rounded-2xl overflow-hidden transition active:scale-[0.99] hover:shadow-md"
                  style={{
                    background: 'var(--bg-2)',
                    boxShadow: 'inset 0 0 0 1px var(--rule)',
                  }}
                >
                  <div
                    className="relative aspect-[16/9] overflow-hidden"
                    style={{ background: '#E4DBC2' }}
                  >
                    {hero.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.cover_url}
                        alt={hero.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen
                          className="w-12 h-12"
                          strokeWidth={1.2}
                          color="var(--ink)"
                          style={{ opacity: 0.35 }}
                        />
                      </div>
                    )}
                    <span
                      className="absolute top-3 left-3 kicker"
                      style={{
                        color: 'var(--ink)',
                        background: 'rgba(245,240,230,0.9)',
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 9,
                      }}
                    >
                      Latest
                    </span>
                  </div>
                  <div
                    className="p-5"
                    style={{ borderTop: '1px solid var(--rule)' }}
                  >
                    {hero.category_id && catById.get(hero.category_id) && (
                      <span className="kicker kicker-moss">
                        {catById.get(hero.category_id)!.name}
                      </span>
                    )}
                    <h2
                      className="font-serif mt-2 text-[18px] font-black leading-snug"
                      style={{
                        color: 'var(--ink)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {hero.title}
                    </h2>
                    {hero.excerpt && (
                      <p
                        className="text-[12.5px] mt-2 leading-relaxed line-clamp-2"
                        style={{ color: 'var(--muted)' }}
                      >
                        {hero.excerpt}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--muted)' }}
                      >
                        {formatDate(hero.published_at)}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold"
                        style={{ color: 'var(--terracotta)' }}
                      >
                        읽기
                        <ArrowUpRight
                          className="w-3 h-3"
                          strokeWidth={2.5}
                        />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            </section>
          )}

          {/* ── 리스트 ─────────────────────────── */}
          {rest.length > 0 && (
            <section className="px-5 mt-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="kicker kicker-muted">
                  More · 더 읽어보기
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: 'var(--rule-2)' }}
                />
              </div>
              <ul className="space-y-3">
                {rest.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="group block rounded-xl overflow-hidden transition active:scale-[0.99]"
                      style={{
                        background: 'var(--bg-2)',
                        boxShadow: 'inset 0 0 0 1px var(--rule)',
                      }}
                    >
                      <article className="flex gap-3">
                        <div
                          className="shrink-0 w-28 aspect-square overflow-hidden"
                          style={{ background: 'var(--rule-2)' }}
                        >
                          {p.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.cover_url}
                              alt={p.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen
                                className="w-6 h-6"
                                strokeWidth={1.5}
                                color="var(--ink)"
                                style={{ opacity: 0.35 }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-3 pr-3">
                          {p.category_id &&
                            catById.get(p.category_id) && (
                              <span
                                className="kicker kicker-moss"
                                style={{ fontSize: 9 }}
                              >
                                {catById.get(p.category_id)!.name}
                              </span>
                            )}
                          <h3
                            className="font-serif text-[13.5px] font-black leading-snug mt-1 line-clamp-2"
                            style={{
                              color: 'var(--ink)',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {p.title}
                          </h3>
                          <p
                            className="text-[10.5px] mt-1.5"
                            style={{ color: 'var(--muted)' }}
                          >
                            {formatDate(p.published_at)}
                          </p>
                        </div>
                      </article>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PublicPageShell>
  )
}
