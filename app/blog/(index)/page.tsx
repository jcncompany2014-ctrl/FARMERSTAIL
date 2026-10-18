import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { visibleMagazineCategories } from '@/lib/magazine/categories'
import StoreShell from '@/components/store/StoreShell'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'

/**
 * /blog — 매거진 목록.
 * 데이터/로직(blog_categories·blog_posts·카테고리 필터·ISR) 보존, 모양만 바꾼다.
 * 블로그 cover_url 은 DB 의 실제 콘텐츠 이미지(Unsplash·Supabase Storage) → next/image 유지(큰 원본을 칸 크기로 줄여 받는다).
 *
 * # 2026-10-10 웹 리뉴얼 — 웹 시안 WEB-C08
 * 가게 틀(StoreShell) 안에서 위에서부터: 머리말·큰 제목·소개 → 카테고리 단추 칸(전체 + DB 카테고리)
 *   → 최신 글 한 편(큰 사진·'최신 글' 딱지) → 나머지 글 목록(먹선 아래 한 줄씩, 오른쪽 작은 사진).
 * 글 제목·요약·날짜·카테고리 이름은 DB 그대로 보여 준다(우리가 고치지 않는다).
 * 예전 하단 설문 버튼(StickyCta → /start)은 없앴다 — 웹 설문은 앱으로 옮겼다. 그 버튼 주소를 고르려고만 부르던
 * 로그인 조회(getUser)도 같이 뺐다. 예전 FD 톤 판은 git 이력.
 */
export const revalidate = 3600

const BLOG_OG = ogImageUrl({
  title: '매거진',
  subtitle: '반려견 영양·건강·케어에 관한 파머스테일의 이야기',
  tag: 'Magazine',
  variant: 'editorial',
})

// 2026-10-11 SEO: 설명이 27자라 검색 결과에서 구글이 아무 문장이나 뽑아 썼다 — 매거진이 답하는 질문을 그대로 적는다.
const BLOG_DESCRIPTION =
  '강아지 화식을 처음 시작할 때 궁금한 것들 — 바꾸는 법, 하루 양, 사료에 곁들이는 법, 알레르기가 의심될 때까지 파머스테일이 차근차근 정리했어요.'

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명을 1회 붙이므로 페이지명만
  // (중복 '| 파머스테일' 방지, 회차147). OG/twitter 는 template 미적용=풀네임 유지.
  title: '매거진 — 강아지 화식·영양 이야기',
  description: BLOG_DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    title: '매거진 | 파머스테일',
    description: BLOG_DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/blog',
    images: [{ url: BLOG_OG, width: 1200, height: 630, alt: '파머스테일 매거진' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '매거진 | 파머스테일',
    description: BLOG_DESCRIPTION,
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

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 카테고리 단추(시안 C08) — 높이 48 · 모서리 4 · 고른 것은 먹색 바탕 흰 글자, 나머지는 회색 테. */
function CategoryButton({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      style={{
        minHeight: 48,
        padding: '0 4px',
        boxSizing: 'border-box',
        borderRadius: 4,
        border: active ? '1px solid #141414' : '1px solid #BDBDBD',
        background: active ? '#141414' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#141414',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: active ? 800 : 700,
        lineHeight: 1.2,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { category: catSlug } = await searchParams
  const supabase = await createClient()

  const { data: categories, error: catsErr } = await supabase
    .from('blog_categories')
    .select('id, slug, name')
    .order('sort_order', { ascending: true })
  if (catsErr) console.error('[blog] categories query failed', catsErr)
  const cats = (categories ?? []) as Category[]

  // 공개 글은 한 번에 다 읽는다 — 카테고리별 글 수(빈 카테고리 숨김)와 카테고리 거르기를 같은 목록으로 한다.
  const { data: posts, error: postsErr } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_url, category_id, published_at, views')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (postsErr) console.error('[blog] posts query failed', postsErr)
  const allRows = (posts ?? []) as Post[]

  // ★공개 글이 0편인 카테고리는 단추를 숨긴다 — 눌렀더니 빈 '준비 중' 화면이 나오지 않게(2026-10-13 토스 심사 준비, 규칙212).
  //   글 수는 실제 공개 글로 센다. 조회가 실패하면 글 수를 모르므로(0편이 아니다 — AGENTS 규칙1) 지금처럼 다 보인다.
  const shownCats = visibleMagazineCategories(cats, postsErr ? null : allRows)
  const activeCategory = catSlug ? shownCats.find((c) => c.slug === catSlug) : null
  // 글이 없어 숨긴 카테고리 주소(옛 링크·직접 입력)는 없는 카테고리 값과 똑같이 '전체' 목록을 그대로 보여 준다(activeCategory 없음).
  //   ★redirect 하지 않는다 — 로딩 화면(loading.tsx)이 먼저 흘러나간 뒤라 redirect 는 HTTP 200 + 빈 화면 + 1초 뒤 meta refresh 가
  //   됐다(2026-10-14, 규칙223). 검색 정본은 이 목록 전체가 /blog 하나(metadata.alternates.canonical) — 카테고리 값마다 따로 두지 않는다.
  const rows = activeCategory ? allRows.filter((p) => p.category_id === activeCategory.id) : allRows
  const catById = new Map(cats.map((c) => [c.id, c]))
  const [hero, ...rest] = rows
  const heroCat = hero?.category_id ? catById.get(hero.category_id) : undefined

  // 매거진 인덱스 BreadcrumbList(홈 › 매거진) — 다른 마케팅 페이지와 동일 패턴.
  // blog/[slug] 상세는 Article+Breadcrumb 보유했으나 인덱스 자체는 누락이었음(회차140).
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '매거진', path: '/blog' },
  ])

  // 카테고리 단추 칸 — 시안은 4칸 한 줄(전체 + 셋). DB 카테고리가 더 많으면 3칸씩 줄을 늘려 이름이 잘리지 않게 한다.
  const navCols = shownCats.length + 1 <= 4 ? 4 : 3

  return (
    <StoreShell wide>
      <JsonLd id="ld-blog-crumbs" data={crumbLd} />
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 머리말 · 큰 제목 · 소개 · 카테고리 ── */}
        <section className="fts-sec" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>매거진</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            파머스테일
            <br />
            매거진
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>반려견 영양·건강·돌봄에 관한 파머스테일의 이야기예요.</p>
          <nav aria-label="카테고리" className="fts-blog-cats" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: `repeat(${navCols}, minmax(0, 1fr))`, gap: 6 }}>
            <CategoryButton href="/blog" active={!activeCategory}>
              전체
            </CategoryButton>
            {shownCats.map((c) => (
              <CategoryButton key={c.id} href={`/blog?category=${c.slug}`} active={activeCategory?.id === c.id}>
                {c.name}
              </CategoryButton>
            ))}
          </nav>
        </section>

        {rows.length === 0 || !hero ? (
          <section className="fts-sec" style={{ padding: '28px 20px 64px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '36px 20px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
              <strong style={{ fontSize: 18, fontWeight: 800 }}>아직 게시된 글이 없어요</strong>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>
                {activeCategory ? `"${activeCategory.name}" 카테고리는 준비 중이에요` : '곧 첫 번째 이야기를 만나보세요.'}
              </span>
            </div>
          </section>
        ) : (
          <>
            {/* ── 최신 글 한 편 — 큰 사진 · '최신 글' 딱지 · 제목 · 요약 · 날짜/읽기 ── */}
            {/* PC(폭 1024 이상): 최신 글은 왼쪽 사진 · 오른쪽 글 2단, 나머지는 3열 카드(store.css .fts-blog-*) */}
            <section className="fts-sec" style={{ padding: rest.length > 0 ? '28px 20px 0' : '28px 20px 64px', display: 'flex', flexDirection: 'column' }}>
              <Link href={`/blog/${hero.slug}`} className="fts-blog-hero" style={{ display: 'flex', flexDirection: 'column', color: '#141414', textDecoration: 'none' }}>
                {hero.cover_url && (
                  <span className="fts-blog-hero-img" style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '350 / 220', borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                    <Image
                      src={hero.cover_url}
                      alt={hero.title}
                      fill
                      loading="eager"
                      fetchPriority="high"
                      sizes="(min-width: 1024px) 700px, (max-width: 480px) calc(100vw - 40px), 440px"
                      style={{ objectFit: 'cover' }}
                    />
                  </span>
                )}
                <span style={{ marginTop: hero.cover_url ? 14 : 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800 }}>
                  <span style={{ height: 26, padding: '0 8px', borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center' }}>최신 글</span>
                  {heroCat && <span style={{ color: '#595959' }}>{heroCat.name}</span>}
                </span>
                {/* 가게 틀은 main 안 h2 를 포스터 글꼴로 바꾸고, 전역 규칙은 제목 줄을 고르게 나눈다(text-wrap: balance).
                    시안의 이 제목은 본문 글꼴 굵게 + 보통 줄바꿈이라 둘 다 되돌린다(제목 태그는 화면 낭독용으로 남긴다). */}
                <h2 style={{ margin: '8px 0 0', fontFamily: 'inherit', fontSize: 24, fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.03em', textWrap: 'wrap' }}>{hero.title}</h2>
                {hero.excerpt && <span style={{ marginTop: 8, fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{hero.excerpt}</span>}
                <span style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 15, color: '#595959' }}>{formatDate(hero.published_at)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 800 }}>
                    읽기
                    <Chevron size={16} />
                  </span>
                </span>
              </Link>
            </section>

            {/* ── 나머지 글 — 먹선 아래 한 줄씩(카테고리 · 제목 · 날짜 + 오른쪽 96 사진) ── */}
            {rest.length > 0 && (
              <section className="fts-sec" style={{ padding: '32px 20px 64px', display: 'flex', flexDirection: 'column' }}>
                <div className="fts-blog-grid" style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
                  {rest.map((p) => {
                    const cat = p.category_id ? catById.get(p.category_id) : undefined
                    return (
                      <Link
                        key={p.id}
                        href={`/blog/${p.slug}`}
                        className="fts-blog-card"
                        style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #E5E5E5',
                          display: 'grid',
                          gridTemplateColumns: p.cover_url ? '1fr 96px' : '1fr',
                          columnGap: 14,
                          alignItems: 'start',
                          color: '#141414',
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {cat && <span style={{ fontSize: 14, fontWeight: 800, color: '#595959' }}>{cat.name}</span>}
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.4, textWrap: 'wrap' }}>{p.title}</h3>
                          <span style={{ fontSize: 14, color: '#595959' }}>{formatDate(p.published_at)}</span>
                        </span>
                        {p.cover_url && (
                          <span className="fts-blog-thumb" style={{ position: 'relative', display: 'block', width: 96, height: 96, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                            <Image src={p.cover_url} alt="" fill loading="lazy" sizes="(min-width: 1024px) 400px, 96px" style={{ objectFit: 'cover' }} />
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </StoreShell>
  )
}
