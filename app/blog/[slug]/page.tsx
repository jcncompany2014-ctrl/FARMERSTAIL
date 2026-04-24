import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BookOpen, Eye, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PublicPageShell from '@/components/PublicPageShell'
import JsonLd from '@/components/JsonLd'
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'

/**
 * /blog/[slug] — 매거진 상세.
 *
 * 톤: /blog 인덱스와 같은 editorial 언어. kicker + serif 헤드라인 + paper-tone
 * 카드. 관련 글 리스트는 blog 인덱스 More 카드와 동일한 horizontal 레이아웃.
 */

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  cover_url: string | null
  category_id: string | null
  published_at: string | null
  views: number | null
}

const getPost = cache(async (slug: string): Promise<Post | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, content, cover_url, category_id, published_at, views'
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  return (data as Post) ?? null
})

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return { title: '글을 찾을 수 없음' }
  }

  const description =
    post.excerpt ?? post.content.slice(0, 140).replace(/\s+/g, ' ')

  // Reuse /api/og fallback so every article has a branded Kakao share card
  // even when the admin forgot to set a cover.
  const ogFallback = `/api/og?variant=editorial&title=${encodeURIComponent(
    post.title
  )}&subtitle=${encodeURIComponent(description.slice(0, 100))}&tag=${encodeURIComponent('Magazine')}`

  const images = post.cover_url
    ? [
        { url: post.cover_url, alt: post.title },
        { url: ogFallback, width: 1200, height: 630, alt: post.title },
      ]
    : [{ url: ogFallback, width: 1200, height: 630, alt: post.title }]

  return {
    title: `${post.title} | 파머스테일 매거진`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: `/blog/${slug}`,
      images,
      publishedTime: post.published_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: images.map((i) => i.url),
    },
  }
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  // Bump view counter — fire-and-forget via RPC so it doesn't slow the
  // server render. The RPC internally enforces is_published = true.
  const supabase = await createClient()
  supabase.rpc('increment_blog_view', { post_slug: slug }).then(() => {})

  // Pull category name + a few related posts in parallel. Related posts are
  // same-category (ordered by published_at DESC, excluding current).
  const [{ data: cat }, { data: related }] = await Promise.all([
    post.category_id
      ? supabase
          .from('blog_categories')
          .select('name, slug')
          .eq('id', post.category_id)
          .single()
      : Promise.resolve({ data: null as { name: string; slug: string } | null }),
    post.category_id
      ? supabase
          .from('blog_posts')
          .select('id, slug, title, cover_url, published_at')
          .eq('is_published', true)
          .eq('category_id', post.category_id)
          .neq('id', post.id)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(3)
      : Promise.resolve({
          data: [] as Array<{
            id: string
            slug: string
            title: string
            cover_url: string | null
            published_at: string | null
          }>,
        }),
  ])

  const relatedPosts = related ?? []

  const articleLd = buildArticleJsonLd({
    title: post.title,
    slug: post.slug,
    description:
      post.excerpt ??
      post.content.slice(0, 180).replace(/\s+/g, ' '),
    coverUrl: post.cover_url,
    publishedAt: post.published_at,
  })
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '매거진', path: '/blog' },
    ...(cat
      ? [{ name: cat.name, path: `/blog?category=${cat.slug}` }]
      : []),
    { name: post.title, path: `/blog/${post.slug}` },
  ])

  return (
    <PublicPageShell backHref="/blog" backLabel="매거진">
      <JsonLd id={`ld-article-${post.slug}`} data={articleLd} />
      <JsonLd id={`ld-breadcrumb-blog-${post.slug}`} data={breadcrumbLd} />
      {/* ── Cover ──────────────────────────────────────── */}
      {post.cover_url ? (
        <div
          className="w-full aspect-[16/9] overflow-hidden mt-3"
          style={{ background: '#E4DBC2' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full aspect-[16/9] flex items-center justify-center mt-3"
          style={{ background: '#E4DBC2' }}
        >
          <BookOpen
            className="w-12 h-12"
            strokeWidth={1.2}
            color="var(--ink)"
            style={{ opacity: 0.35 }}
          />
        </div>
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker" style={{ color: 'var(--terracotta)' }}>
            Article · 매거진
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>

        {cat && (
          <Link
            href={`/blog?category=${cat.slug}`}
            className="inline-block transition"
          >
            <span className="kicker kicker-moss">{cat.name}</span>
          </Link>
        )}
        <h1
          className="font-serif mt-2 leading-tight"
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {post.title}
        </h1>
        {post.excerpt && (
          <p
            className="mt-3 text-[13px] leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            {post.excerpt}
          </p>
        )}
        <div
          className="mt-4 flex items-center gap-3 text-[11px]"
          style={{ color: 'var(--muted)' }}
        >
          <span>{formatDate(post.published_at)}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3" strokeWidth={2} />
            {(post.views ?? 0).toLocaleString()}
          </span>
        </div>
      </header>

      {/* ── Rule ───────────────────────────────────────── */}
      <div className="px-5">
        <div
          className="h-px"
          style={{ background: 'var(--rule-2)' }}
        />
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <article className="px-5 pt-6">
        <div
          className="text-[14px] whitespace-pre-line"
          style={{
            color: 'var(--text)',
            lineHeight: 1.8,
          }}
        >
          {post.content}
        </div>
      </article>

      {/* ── Related ────────────────────────────────────── */}
      {relatedPosts.length > 0 && (
        <section className="px-5 mt-12 pb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="kicker kicker-muted">Related · 관련 글</span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <ul className="space-y-3">
            {relatedPosts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="group block rounded-xl overflow-hidden transition active:scale-[0.99]"
                  style={{
                    background: 'var(--bg-2)',
                    boxShadow: 'inset 0 0 0 1px var(--rule)',
                  }}
                >
                  <article className="flex gap-3">
                    <div
                      className="shrink-0 w-24 aspect-square overflow-hidden"
                      style={{ background: 'var(--rule-2)' }}
                    >
                      {r.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.cover_url}
                          alt={r.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen
                            className="w-5 h-5"
                            strokeWidth={1.5}
                            color="var(--ink)"
                            style={{ opacity: 0.35 }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-2.5 pr-3">
                      <h3
                        className="font-serif text-[13px] font-black leading-snug line-clamp-2"
                        style={{
                          color: 'var(--ink)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {r.title}
                      </h3>
                      <div className="mt-1.5 flex items-center justify-between">
                        <p
                          className="text-[10px]"
                          style={{ color: 'var(--muted)' }}
                        >
                          {formatDate(r.published_at)}
                        </p>
                        <ArrowUpRight
                          className="w-3 h-3"
                          strokeWidth={2.5}
                          color="var(--terracotta)"
                        />
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PublicPageShell>
  )
}
