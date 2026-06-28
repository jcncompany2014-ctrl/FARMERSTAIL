import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BookOpen, Eye, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import ShareButton from '@/components/ShareButton'
import { renderMarkdown } from '@/lib/markdown'
import { BLUR_BG2 } from '@/lib/ui/blur'
import JsonLd from '@/components/JsonLd'
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { Container, Display, Eyebrow, Section } from '@/components/web/fd/ui'
import StickyCta from '@/components/web/fd/StickyCta'

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
    .maybeSingle()
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
    timeZone: 'Asia/Seoul',
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

  // 읽는 시간 추정 — 한국어 ~500자/분, 마크업 제거 후 길이 기준, 최소 1분(회차122).
  const readingMin = Math.max(
    1,
    Math.round((post.content || '').replace(/<[^>]+>/g, '').length / 500),
  )

  return (
    <WebChrome>
      <main>
        <JsonLd id={`ld-article-${post.slug}`} data={articleLd} />
        <JsonLd id={`ld-breadcrumb-blog-${post.slug}`} data={breadcrumbLd} />

        {/* Header */}
        <Section bg="offwhite" pad="sm">
          <Container size="md">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 no-underline text-[13px]"
              style={{ color: 'var(--fd-muted)', fontWeight: 700 }}
            >
              ← 매거진
            </Link>
            <div className="pt-5">
              {cat && (
                <Link href={`/blog?category=${cat.slug}`} className="no-underline">
                  <Eyebrow>{cat.name}</Eyebrow>
                </Link>
              )}
              <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                {post.title}
              </Display>
              {post.excerpt && (
                <p className="pt-4 text-[14px] md:text-[17px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                  {post.excerpt}
                </p>
              )}
              <div className="pt-5 flex items-center gap-3 text-[12px] flex-wrap" style={{ color: 'var(--fd-muted)' }}>
                <span>{formatDate(post.published_at)}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{readingMin}분 읽기</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" strokeWidth={2} />
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
            </div>
          </Container>
        </Section>

        {/* Cover */}
        <Container size="md" className="pb-2">
          {post.cover_url ? (
            <div className="relative w-full aspect-[16/9] overflow-hidden" style={{ background: 'var(--fd-cream)', borderRadius: 8 }}>
              <Image
                src={post.cover_url}
                alt={post.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 760px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-[16/9] flex items-center justify-center" style={{ background: 'var(--fd-cream)', borderRadius: 8 }}>
              <BookOpen className="w-12 h-12 md:w-16 md:h-16" strokeWidth={1.2} color="var(--fd-green)" style={{ opacity: 0.4 }} />
            </div>
          )}
        </Container>

        {/* Body */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <div
              className="ft-md text-[15px] md:text-[17px]"
              style={{ color: 'var(--fd-pine)', lineHeight: 1.85 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
            />
          </Container>
        </Section>

        {/* Related */}
        {relatedPosts.length > 0 && (
          <Section bg="cream" pad="md">
            <Container size="lg">
              <Eyebrow>RELATED</Eyebrow>
              <h2 className="sr-only">관련 글</h2>
              <div className="pt-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                {relatedPosts.map((r) => (
                  <Link
                    key={r.id}
                    href={`/blog/${r.slug}`}
                    className="group block no-underline"
                    style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, overflow: 'hidden' }}
                  >
                    <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ background: 'var(--fd-cream)' }}>
                      {r.cover_url ? (
                        <Image
                          src={r.cover_url}
                          alt={r.title}
                          fill
                          sizes="(max-width: 768px) 50vw, 260px"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_BG2}
                          className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-7 h-7" strokeWidth={1.4} color="var(--fd-green)" style={{ opacity: 0.4 }} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-[14px] line-clamp-2" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                        {r.title}
                      </h3>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px]" style={{ color: 'var(--fd-muted)', fontWeight: 600 }}>
                          {formatDate(r.published_at)}
                        </p>
                        <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} color="var(--fd-coral)" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Container>
          </Section>
        )}
      </main>
      {/*
        FD 패턴: 기사 스크롤 끝에서 모바일 하단 sticky CTA(설문 퍼널). /blog
        인덱스(회차98)와 동일 노출. 단 이 페이지는 ISR(revalidate 300) 최적화를
        보존해야 하므로 isAuthed 분기를 위한 getUser 를 호출하지 않고 정적
        /signup 으로 보낸다(authed 는 /signup 이 리다이렉트 처리 — not-found.tsx
        회차125 선례와 동일). 캐시 보존 > authed/anon href 미세 구분.
      */}
      <StickyCta href="/start" />
    </WebChrome>
  )
}
