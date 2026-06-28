import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import Reveal from '@/components/landing/Reveal'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import { Container, Display, Eyebrow, Section } from '@/components/web/fd/ui'
import StickyCta from '@/components/web/fd/StickyCta'

/**
 * /blog — 매거진 인덱스 (farm v6 = FD 톤 리스타일, 2026-06-13).
 * 데이터/로직(blog_categories·blog_posts·카테고리 필터·ISR) 보존, presentation만 FD.
 * 블로그 cover_url 은 실제 콘텐츠 이미지 → next/image 유지(placeholder 아님).
 */
export const revalidate = 300

const BLOG_OG = ogImageUrl({
  title: '매거진',
  subtitle: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
  tag: 'Magazine',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명을 1회 붙이므로 페이지명만
  // (중복 '| 파머스테일' 방지, 회차147). OG/twitter 는 template 미적용=풀네임 유지.
  title: '매거진',
  description: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: '매거진 | 파머스테일',
    description: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
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

type Category = { id: string; slug: string; name: string }
type SearchParams = Promise<{ category?: string }>

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  })
}

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid var(--fd-line)',
  borderRadius: 8,
  overflow: 'hidden',
}

function CatLabel({ name }: { name: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fd-green)' }}>
      {name}
    </span>
  )
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { category: catSlug } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

  const { data: categories, error: catsErr } = await supabase
    .from('blog_categories')
    .select('id, slug, name')
    .order('sort_order', { ascending: true })
  if (catsErr) console.error('[blog] categories query failed', catsErr)
  const cats = (categories ?? []) as Category[]
  const activeCategory = catSlug ? cats.find((c) => c.slug === catSlug) : null

  let query = supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_url, category_id, published_at, views')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (activeCategory) query = query.eq('category_id', activeCategory.id)

  const { data: posts, error: postsErr } = await query
  if (postsErr) console.error('[blog] posts query failed', postsErr)
  const rows = (posts ?? []) as Post[]
  const catById = new Map(cats.map((c) => [c.id, c]))
  const [hero, ...rest] = rows

  // 매거진 인덱스 BreadcrumbList(홈 › 매거진) — 다른 마케팅 페이지와 동일 패턴.
  // blog/[slug] 상세는 Article+Breadcrumb 보유했으나 인덱스 자체는 누락이었음(회차140).
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '매거진', path: '/blog' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-blog-crumbs" data={crumbLd} />
        {/* Hero */}
        <Section bg="offwhite" pad="sm">
          <Container size="lg">
            <Eyebrow>MAGAZINE</Eyebrow>
            <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              파머스테일 매거진
            </Display>
            <p className="pt-3 text-[14px] md:text-[16px]" style={{ color: 'var(--fd-muted)', maxWidth: 520, lineHeight: 1.6 }}>
              반려견 영양·건강·케어에 관한 파머스테일의 이야기.
            </p>

            {/* 카테고리 chips */}
            <nav className="mt-6 flex gap-2 overflow-x-auto scrollbar-hide pb-1" aria-label="카테고리">
              <Link
                href="/blog"
                aria-current={!activeCategory ? 'page' : undefined}
                className="shrink-0 rounded-full text-[12px] font-bold whitespace-nowrap no-underline transition"
                style={{
                  padding: '8px 16px',
                  background: !activeCategory ? 'var(--fd-pine)' : '#FFFFFF',
                  color: !activeCategory ? '#FFFFFF' : 'var(--fd-pine)',
                  border: '1px solid ' + (!activeCategory ? 'var(--fd-pine)' : 'var(--fd-line)'),
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
                    aria-current={active ? 'page' : undefined}
                    className="shrink-0 rounded-full text-[12px] font-bold whitespace-nowrap no-underline transition"
                    style={{
                      padding: '8px 16px',
                      background: active ? 'var(--fd-pine)' : '#FFFFFF',
                      color: active ? '#FFFFFF' : 'var(--fd-pine)',
                      border: '1px solid ' + (active ? 'var(--fd-pine)' : 'var(--fd-line)'),
                    }}
                  >
                    {c.name}
                  </Link>
                )
              })}
            </nav>
          </Container>
        </Section>

        {/* Posts */}
        <Section bg="cream" pad="md">
          <Container size="lg">
            {rows.length === 0 ? (
              <div
                className="py-16 flex flex-col items-center text-center"
                style={{ ...CARD, background: 'var(--fd-offwhite)', borderStyle: 'dashed' }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: '#FFFFFF' }}>
                  <BookOpen className="w-5 h-5" strokeWidth={1.8} color="var(--fd-muted)" />
                </div>
                <Eyebrow color="var(--fd-muted)">COMING SOON</Eyebrow>
                <p className="mt-2 text-[16px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>
                  아직 게시된 글이 없어요
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: 'var(--fd-muted)' }}>
                  {activeCategory ? `"${activeCategory.name}" 카테고리는 준비 중이에요` : '곧 첫 번째 이야기를 만나보세요.'}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-5">
                {/* Hero 최신글 — 2칸 차지 */}
                {hero && (
                  <Link href={`/blog/${hero.slug}`} className="md:col-span-3 group block no-underline" style={CARD}>
                    <article className="grid md:grid-cols-2 md:items-stretch">
                      <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden" style={{ background: 'var(--fd-cream)', minHeight: 220 }}>
                        {hero.cover_url ? (
                          <Image src={hero.cover_url} alt={hero.title} fill priority sizes="(max-width:768px) 100vw, 560px" className="object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-12 h-12" strokeWidth={1.2} color="var(--fd-green)" style={{ opacity: 0.4 }} /></div>
                        )}
                      </div>
                      <div className="p-6 md:p-8 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <span aria-hidden style={{ width: 16, height: 2, background: 'var(--fd-coral)' }} />
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-coral-text)', textTransform: 'uppercase' }}>Latest</span>
                          {hero.category_id && catById.get(hero.category_id) && <CatLabel name={catById.get(hero.category_id)!.name} />}
                        </div>
                        <h2 className="mt-3 text-[20px] md:text-[26px]" style={{ fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.03em', lineHeight: 1.18 }}>
                          {hero.title}
                        </h2>
                        {hero.excerpt && (
                          <p className="mt-3 text-[13.5px] md:text-[15px] line-clamp-2" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                            {hero.excerpt}
                          </p>
                        )}
                        <div className="mt-5 flex items-center justify-between">
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fd-muted)' }}>{formatDate(hero.published_at)}</span>
                          <span className="inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 800, color: 'var(--fd-coral-text)' }}>
                            읽기 <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                )}

                {/* 나머지 — 3열 카드 */}
                {rest.map((p, i) => (
                  <Reveal key={p.id} delay={i * 70}>
                  <Link href={`/blog/${p.slug}`} className="group block no-underline" style={CARD}>
                    <article>
                      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: 'var(--fd-cream)' }}>
                        {p.cover_url ? (
                          <Image src={p.cover_url} alt={p.title} fill sizes="(max-width:768px) 100vw, 360px" loading="lazy" className="object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-8 h-8" strokeWidth={1.4} color="var(--fd-green)" style={{ opacity: 0.4 }} /></div>
                        )}
                      </div>
                      <div className="p-5">
                        {p.category_id && catById.get(p.category_id) && <CatLabel name={catById.get(p.category_id)!.name} />}
                        <h3 className="mt-2 text-[16px] line-clamp-2" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                          {p.title}
                        </h3>
                        <p className="mt-3 text-[12px]" style={{ fontWeight: 600, color: 'var(--fd-muted)' }}>{formatDate(p.published_at)}</p>
                      </div>
                    </article>
                  </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </Container>
        </Section>
      </main>
      {/* 모바일 sticky 설문 CTA — 다른 마케팅 페이지와 동일(회차98 재추가, blog 정상화 후) */}
      <StickyCta href={isAuthed ? '/dogs/new' : '/start'} />
    </WebChrome>
  )
}
