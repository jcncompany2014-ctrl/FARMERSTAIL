import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import StoreShell from '@/components/store/StoreShell'
import ShareButton from '@/components/ShareButton'
import { renderMarkdown } from '@/lib/markdown'
import JsonLd from '@/components/JsonLd'
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'

/**
 * /blog/[slug] — 매거진 글.
 *
 * # 2026-10-10 웹 리뉴얼 — 웹 시안 WEB-C09
 * 가게 틀(StoreShell) 안에서 위에서부터: ← 매거진 → 카테고리 · 큰 제목 · 요약 → 날짜·읽는 시간 줄(오른쪽 공유)
 *   → 표지 사진 → 본문 → 같은 주제의 글(2칸).
 * 본문은 DB 글(lib/markdown 렌더 결과) 그대로다 — 우리가 고치지 않는다. 모양만 아래 POST_CSS(.ftb-post)로
 * 시안의 글 칸(17px·줄 1.8·포스터 글꼴 소제목·먹선 목록·회색 인용)에 맞췄다. 예전 .ft-md(명조 제목·주황 링크)는
 * 전역 css 라 웹 리뉴얼 밖 화면(어드민 미리보기)도 쓰므로 그대로 두고, 이 화면만 클래스를 바꿨다.
 * 조회수 숫자는 시안에 없어 뺐다(조회수 올리기 RPC 는 그대로). 예전 하단 설문 버튼(StickyCta → /start)은 없앴다
 * — 웹 설문은 앱으로 옮겼다. 예전 FD 톤 판은 git 이력.
 */

/**
 * 블로그 상세 — 공개 글. ISR 로 5분 TTL. 조회수 카운터는 서버 RPC 기반이라
 * 캐시 히트일 때는 bump 되지 않음 (revalidation 주기에만 증가) — 카운터는
 * 정확한 수치보다는 "상대적 인기도" 용도라 감내 가능. 정확한 카운터가 필요
 * 해지면 client-side view beacon 으로 이전.
 * (이전: force-dynamic — 모든 방문마다 blog_posts + blog_categories 조회.)
 */
export const revalidate = 3600

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
  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, content, cover_url, category_id, published_at, views'
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  // ★error 를 꺼낸다(AGENTS 규칙1). 예전엔 `const { data }` 만 받아서
  //   **조회 실패와 "그런 글 없음"이 구분되지 않았다.** 호출부는 null 이면
  //   notFound() 를 부르므로, DB 가 잠깐 흔들리는 동안 **멀쩡히 발행된 글이
  //   404** 가 된다. 하필 그때 크롤러가 오면 색인에서 빠진다.
  //   던지면 500 이 되고(재시도 대상), 진짜 없는 글만 404 로 남는다.
  if (error) {
    throw new Error(`blog_posts 조회 실패 (slug=${slug}): ${error.message}`)
  }
  return (data as Post) ?? null
})

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  // 없는 글은 메타데이터 단계에서도 404 로 끊는다(2026-08-02 검수).
  //   ※이것만으로는 상태가 안 고쳐졌다 — 진짜 원인은 `app/blog/loading.tsx` 였고
  //     그건 `app/blog/(index)/` 로 옮겨 해결했다(아래 페이지 컴포넌트 주석 참조).
  //     여기 notFound() 는 없는 글에 메타데이터를 만들지 않기 위한 것이다.
  if (!post) notFound()

  const description =
    post.excerpt ?? post.content.slice(0, 140).replace(/\s+/g, ' ')

  // Reuse /og fallback so every article has a branded Kakao share card
  // even when the admin forgot to set a cover.
  const ogFallback = `/og?variant=editorial&title=${encodeURIComponent(
    post.title
  )}&subtitle=${encodeURIComponent(description.slice(0, 100))}&tag=${encodeURIComponent('Magazine')}`

  const images = post.cover_url
    ? [
        { url: post.cover_url, alt: post.title },
        { url: ogFallback, width: 1200, height: 630, alt: post.title },
      ]
    : [{ url: ogFallback, width: 1200, height: 630, alt: post.title }]

  return {
    // ★루트 layout 의 template('%s | 파머스테일')이 브랜드를 한 번 더 붙여
    //   "제목 | 파머스테일 매거진 | 파머스테일" 이 됐다. absolute 로 고정한다.
    title: { absolute: `${post.title} | 파머스테일 매거진` },
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

/**
 * 본문 글 칸(시안 C09 의 article) — lib/markdown 이 만드는 태그(h1~h6·p·ul/li·blockquote·hr·img·a·strong·em·code·pre)만 다룬다.
 * 가게 틀(.fts main h1·h2)이 소제목을 포스터 글꼴로 이미 바꾸므로 여기선 크기·간격만 준다.
 * 목록 바로 뒤 구분선(ul + hr)은 숨긴다 — 목록 줄마다 아래 선이 있어 hr 까지 그리면 빈 줄 하나처럼 보였다(간격은 다음 칸이 갖는다).
 * 공유 단추(.ftb-share) — 공용 ShareButton 의 동작(카카오 → 기기 공유 → 주소 복사)을 그대로 쓰고, 아이콘만 시안 원본 path
 * (M12 3v13 · M7 8l5-5 5 5 · M5 13v6…)로 씌운다. 공용 부품은 고치지 않는다.
 */
const SHARE_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v13'/%3E%3Cpath d='M7 8l5-5 5 5'/%3E%3Cpath d='M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'/%3E%3C/svg%3E\")"

const POST_CSS = `
.ftb-post { font-size: 17px; line-height: 1.8; color: #141414; overflow-wrap: break-word; }
.ftb-post > * { margin: 0; }
.ftb-post > * + * { margin-top: 16px; }
.ftb-post > h1, .ftb-post > h2 { margin-top: 40px; }
.ftb-post > h3 { margin-top: 32px; }
.ftb-post > h4, .ftb-post > h5, .ftb-post > h6 { margin-top: 28px; }
.ftb-post > :first-child { margin-top: 0; }
.ftb-post > h1 + *, .ftb-post > h2 + *, .ftb-post > h3 + *, .ftb-post > h4 + * { margin-top: 12px; }
.ftb-post h1 { font-size: 28px; line-height: 1.2; }
.ftb-post h2 { font-size: 24px; line-height: 1.25; }
.ftb-post h3 { font-family: var(--font-poster), var(--font-sans), sans-serif; font-weight: 400; letter-spacing: -0.01em; font-size: 20px; line-height: 1.3; }
.ftb-post h4, .ftb-post h5, .ftb-post h6 { font-size: 17px; font-weight: 800; line-height: 1.5; }
.ftb-post strong { font-weight: 800; }
.ftb-post em { font-style: normal; }
.ftb-post a { color: #141414; font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
.ftb-post ul { padding: 0; list-style: none; border-top: 2px solid #141414; }
.ftb-post li { position: relative; padding: 14px 0 14px 22px; border-bottom: 1px solid #E5E5E5; line-height: 1.6; }
.ftb-post li::before { content: ''; position: absolute; left: 2px; top: calc(14px + 0.8em - 4px); width: 8px; height: 8px; background: #141414; }
.ftb-post > blockquote { margin-top: 40px; padding: 18px; border-left: 4px solid #141414; background: #F6F4F5; font-size: 16px; line-height: 1.7; }
.ftb-post > blockquote + blockquote { margin-top: 8px; }
.ftb-post > hr { border: 0; border-top: 1px solid #E5E5E5; }
.ftb-post > hr, .ftb-post > hr + * { margin-top: 36px; }
.ftb-post > ul + hr { display: none; }
.ftb-post img { display: block; width: 100%; height: auto; border-radius: 4px; }
.ftb-post > img { margin-top: 20px; }
.ftb-post code { padding: 0.1em 0.4em; border-radius: 4px; background: #F6F4F5; font-size: 0.9em; }
.ftb-post pre { padding: 16px; border-radius: 4px; background: #F6F4F5; overflow-x: auto; font-size: 15px; line-height: 1.6; }
.ftb-post pre code { padding: 0; background: none; }
.ftb-share svg { display: none; }
.ftb-share::before { content: ''; width: 22px; height: 22px; background: currentColor; -webkit-mask: ${SHARE_ICON} center / contain no-repeat; mask: ${SHARE_ICON} center / contain no-repeat; }
`

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params
  const post = await getPost(slug)
  // ★이 notFound() 가 **200 을 내고 있었다**(2026-08-02 검수, 프로덕션 빌드 실측).
  //   /blog/<없는글> → 200 + 빈 본문. 같은 서버에서 /recipe/<없는것>·임의 경로는
  //   정상 404 였다. 200 으로 나가는 "글을 찾을 수 없음" 은 검색엔진에 soft 404 —
  //   존재하지 않는 주소가 멀쩡한 페이지로 색인된다.
  //
  //   원인: `app/blog/loading.tsx` 였다. loading.tsx 는 그 세그먼트**와 하위 전부**를
  //   Suspense 로 감싸므로 [slug] 까지 스트리밍 응답이 된다. 헤더(200)가 먼저
  //   나간 뒤에 notFound() 가 던져지니 상태를 되돌릴 수 없다.
  //   (generateMetadata 에서 notFound() 를 불러도 안 고쳐졌다 — 실제로 해보고 확인.)
  //
  //   해결: 목록 페이지와 loading.tsx 를 `app/blog/(index)/` 로 옮겼다. 라우트
  //   그룹은 URL 에 영향이 없어 /blog 는 그대로이고, 로딩 UI 도 목록에서 그대로
  //   동작한다. 다만 이제 [slug] 를 감싸지 않는다.
  //   검증: 옮긴 뒤 프로덕션 빌드에서 404 + 정상 404 화면 확인.
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
  const metaLine = [formatDate(post.published_at), `${readingMin}분 읽기`].filter(Boolean).join(' · ')

  return (
    <StoreShell>
      <JsonLd id={`ld-article-${post.slug}`} data={articleLd} />
      <JsonLd id={`ld-breadcrumb-blog-${post.slug}`} data={breadcrumbLd} />
      <style>{POST_CSS}</style>

      <div style={{ lineHeight: 'normal' }}>
        {/* ── ← 매거진 · 카테고리 · 큰 제목 · 요약 · 날짜/읽는 시간 + 공유 · 표지 ── */}
        <section style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <Link
            href="/blog"
            style={{ alignSelf: 'flex-start', height: 48, marginLeft: -4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 700, color: '#141414', textDecoration: 'none' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
            매거진
          </Link>
          {cat && (
            <Link
              href={`/blog?category=${cat.slug}`}
              style={{ marginTop: 12, alignSelf: 'flex-start', fontSize: 15, fontWeight: 800, color: '#595959', textDecoration: 'none' }}
            >
              {cat.name}
            </Link>
          )}
          <h1 className="d" style={{ margin: cat ? '8px 0 0' : '12px 0 0', fontSize: 32, lineHeight: 1.2 }}>
            {post.title}
          </h1>
          {post.excerpt && <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>{post.excerpt}</p>}
          <div
            style={{
              marginTop: 16,
              padding: '4px 0',
              borderTop: '1px solid #E5E5E5',
              borderBottom: '1px solid #E5E5E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 15, color: '#595959' }}>{metaLine}</span>
            <ShareButton
              url={`/blog/${post.slug}`}
              title={post.title}
              description={post.excerpt ?? undefined}
              imageUrl={post.cover_url ?? undefined}
              label="이 글 공유하기"
              iconOnly
              className="ftb-share"
              style={{
                width: 48,
                height: 48,
                marginRight: -12,
                flexShrink: 0,
                border: 0,
                background: 'transparent',
                color: '#141414',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            />
          </div>
          {post.cover_url && (
            <span style={{ marginTop: 20, position: 'relative', display: 'block', width: '100%', aspectRatio: '350 / 197', borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
              <Image
                src={post.cover_url}
                alt={post.title}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 480px) calc(100vw - 40px), 440px"
                style={{ objectFit: 'cover' }}
              />
            </span>
          )}
        </section>

        {/* ── 본문 — DB 글 그대로(lib/markdown), 모양은 POST_CSS ── */}
        <article
          className="ftb-post"
          style={{ padding: '28px 20px 0' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        {/* ── 같은 주제의 글 — 같은 카테고리 최신 글(최대 3편), 2칸 ── */}
        {relatedPosts.length > 0 ? (
          <section style={{ padding: '52px 20px 64px', display: 'flex', flexDirection: 'column' }}>
            <h2 className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
              같은 주제의 글
            </h2>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {relatedPosts.map((r) => (
                <Link key={r.id} href={`/blog/${r.slug}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#141414', textDecoration: 'none' }}>
                  <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                    {r.cover_url && (
                      <Image src={r.cover_url} alt="" fill loading="lazy" sizes="(max-width: 480px) calc(50vw - 25px), 215px" style={{ objectFit: 'cover' }} />
                    )}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.4, textWrap: 'wrap' }}>{r.title}</h3>
                  <span style={{ fontSize: 14, color: '#595959' }}>{formatDate(r.published_at)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <div aria-hidden style={{ height: 64 }} />
        )}
      </div>
    </StoreShell>
  )
}
