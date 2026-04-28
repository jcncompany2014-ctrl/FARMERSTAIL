import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BookOpen, Eye, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import ShareButton from '@/components/ShareButton'
import { renderMarkdown } from '@/lib/markdown'
import JsonLd from '@/components/JsonLd'
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'

/**
 * /blog/[slug] — 매거진 상세.
 *
 * 톤: /blog 인덱스와 같은 editorial 언어. kicker + serif 헤드라인 + paper-tone
 * 카드. 관련 글 리스트는 blog 인덱스 More 카드와 동일한 horizontal 레이아웃.
 */

/**
 * 블로그 상세 — 공개 글. ISR 로 5분 TTL. 조회수 카운터는 서버 RPC 기반이라
 * 캐시 히트일 때는 bump 되지 않음 (revalidation 주기에만 증가) — 카운터는
 * 정확한 수치보다는 "상대적 인기도" 용도라 감내 가능. 정확한 카운터가 필요
 * 해지면 client-side view beacon 으로 이전.
 * (이전: force-dynamic — 모든 방문마다 blog_posts + blog_categories 조회.)
 */
export const revalidate = 300

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
    <AuthAwareShell>
      <article className="mx-auto" style={{ maxWidth: 820, background: 'var(--bg)' }}>
      <JsonLd id={`ld-article-${post.slug}`} data={articleLd} />
      <JsonLd id={`ld-breadcrumb-blog-${post.slug}`} data={breadcrumbLd} />
      <div className="px-5 md:px-8 pt-5 md:pt-7">
        <Link
          href="/blog"
          className="inline-flex items-center gap-0.5 text-[11px] md:text-[12.5px] font-bold transition"
          style={{ color: 'var(--muted)' }}
        >
          ← 매거진
        </Link>
      </div>
      {/* ── Cover ──────────────────────────────────────── */}
      {post.cover_url ? (
        <div
          className="relative w-full aspect-[16/9] overflow-hidden mt-3 md:mt-5 md:rounded-2xl"
          style={{ background: '#E4DBC2' }}
        >
          <Image
            src={post.cover_url}
            alt={post.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 820px"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="w-full aspect-[16/9] flex items-center justify-center mt-3 md:mt-5 md:rounded-2xl"
          style={{ background: '#E4DBC2' }}
        >
          <BookOpen
            className="w-12 h-12 md:w-16 md:h-16"
            strokeWidth={1.2}
            color="var(--ink)"
            style={{ opacity: 0.35 }}
          />
        </div>
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <header className="px-5 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6">
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
          className="font-serif mt-2 md:mt-3 leading-tight text-[26px] md:text-[40px] lg:text-[48px]"
          style={{
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
          }}
        >
          {post.title}
        </h1>
        {post.excerpt && (
          <p
            className="mt-3 md:mt-5 text-[13px] md:text-[16px] leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            {post.excerpt}
          </p>
        )}
        <div
          className="mt-4 md:mt-6 flex items-center gap-3 text-[11px] md:text-[12.5px] flex-wrap"
          style={{ color: 'var(--muted)' }}
        >
          <span>{formatDate(post.published_at)}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2} />
            {(post.views ?? 0).toLocaleString()}
          </span>
          <span className="ml-auto">
            <ShareButton
              url={`/blog/${post.slug}`}
              title={post.title}
              description={post.excerpt ?? undefined}
              imageUrl={post.cover_url ?? undefined}
            />
          </span>
        </div>
      </header>

      {/* ── Rule ───────────────────────────────────────── */}
      <div className="px-5 md:px-8">
        <div
          className="h-px"
          style={{ background: 'var(--rule-2)' }}
        />
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <article className="px-5 md:px-8 pt-6 md:pt-10">
        <div
          className="ft-md text-[14px] md:text-[17px]"
          style={{
            color: 'var(--text)',
            lineHeight: 1.85,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />
      </article>

      {/* ── Related ────────────────────────────────────── */}
      {relatedPosts.length > 0 && (
        <section className="px-5 md:px-8 mt-12 md:mt-16 pb-12 md:pb-20">
          <div className="flex items-center gap-2 mb-3 md:mb-5">
            <span className="kicker kicker-muted">Related · 관련 글</span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <ul className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
            {relatedPosts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="group block rounded-xl overflow-hidden transition active:scale-[0.99] h-full"
                  style={{
                    background: 'var(--bg-2)',
                    boxShadow: 'inset 0 0 0 1px var(--rule)',
                  }}
                >
                  <article className="flex md:flex-col gap-3 md:gap-0 h-full">
                    <div
                      className="relative shrink-0 w-24 aspect-square md:w-full md:aspect-[4/3] overflow-hidden"
                      style={{ background: 'var(--rule-2)' }}
                    >
                      {r.cover_url ? (
                        <Image
                          src={r.cover_url}
                          alt={r.title}
                          fill
                          sizes="(max-width: 768px) 96px, 260px"
                          loading="lazy"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen
                            className="w-5 h-5 md:w-7 md:h-7"
                            strokeWidth={1.5}
                            color="var(--ink)"
                            style={{ opacity: 0.35 }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-2.5 pr-3 md:p-4">
                      <h3
                        className="font-serif text-[13px] md:text-[15px] font-black leading-snug line-clamp-2"
                        style={{
                          color: 'var(--ink)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {r.title}
                      </h3>
                      <div className="mt-1.5 md:mt-3 flex items-center justify-between">
                        <p
                          className="text-[10px] md:text-[11px]"
                          style={{ color: 'var(--muted)' }}
                        >
                          {formatDate(r.published_at)}
                        </p>
                        <ArrowUpRight
                          className="w-3 h-3 md:w-3.5 md:h-3.5"
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
      </article>
    </AuthAwareShell>
  )
}
