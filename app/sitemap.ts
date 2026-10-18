import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { STORE_RECIPES } from '@/lib/store/catalog'

// R72 — production fallback 을 www. 으로 통일 (Vercel 의 primary 도메인).
// NEXT_PUBLIC_SITE_URL env 가 우선 — 셋업돼 있으면 그 값 사용.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export const revalidate = 3600 // 1시간마다 재생성

/**
 * 고정 화면의 lastmod = 마지막으로 크게 바뀐 날. 매번 지금 시각을 주면 구글은 lastmod 를 믿지 않고 무시한다
 * (2026-10-11 점검 — 웹 리뉴얼 뒤 옛 제목·설명이 검색에 남아 있어, 다시 가져가게 하려면 날짜가 정확해야 한다).
 * 화면을 크게 고치면 이 날짜를 올린다.
 */
const WEB_RENEWED = new Date('2026-10-11T00:00:00+09:00')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 정적 페이지.
  // 넘기기만 하는 옛 주소(/products·/collections·/best·/new·/plans → /store, /events·/why-app·웹 /start → /app)는
  // 넣지 않는다 — 크롤러가 넘김 주소를 색인하면 중복·리다이렉트 경고가 난다.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // ★2026-10-10 웹 리뉴얼 — 웹 = 단품 가게(/store·레시피 4종), 맞춤·정기배송 = 앱(/app).
    //   /start(웹 설문 → 행사 링크 전용·그 밖은 /app)·/why-app(→ /app)·/plans(→ /store)는 넘기기만 하므로 뺐다 —
    //   넘기는 주소를 올리면 GSC 가 리다이렉트 경고를 낸다. 넘기기(308)는 그대로 둬야 옛 색인이 새 주소로 옮겨 간다.
    {
      url: `${siteUrl}/store`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...STORE_RECIPES.map((r) => ({
      url: `${siteUrl}/store/${r}`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    {
      url: `${siteUrl}/app`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // 에디토리얼 마케팅 서브루트 — 브랜드 이야기 · 정기배송 플랜.
    {
      url: `${siteUrl}/about`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/brand`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/our-food`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // 신선식 교육 페이지 (왜 화식인가) — FD /why-fresh 대응.
    {
      url: `${siteUrl}/why-fresh`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // /reviews — 2026-09-05 숨김(후기 없음) → 2026-10-18 다시 열었다(스마트스토어·인스타 후기 정본 lib/store/reviews).
    // lastmod 는 후기를 옮긴 날로 고정(매번 now 면 검색엔진이 무시한다 — 2026-10-11 SEO 점검).
    {
      url: `${siteUrl}/reviews`,
      lastModified: new Date('2026-10-18T00:00:00+09:00'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // 신규 콘텐츠 페이지 — FAQ / 뉴스레터 / 과학 alias
    // /partners(농장 파트너)는 뺐다 — 공개된 농가가 없는 빈 화면이라 noindex(2026-10-13, 규칙213). 농가를 공개하면 되돌린다.
    {
      url: `${siteUrl}/faq`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/newsletter`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/science`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // login / signup 은 robots.ts 에서 disallow — sitemap 에 포함하면
    // GSC 가 "Submitted URL blocked by robots.txt" 경고를 내고 문서 자체에도
    // 모순. 제거.
    // 법정 필수 표기 페이지 — 검색엔진이 찾을 수 있게 포함.
    {
      url: `${siteUrl}/business`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/terms`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/privacy`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/refund`,
      lastModified: WEB_RENEWED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // 동적 페이지 — blog posts 만 (products/collections/events 는 구독 전환으로
  // redirect 되어 제외). Supabase fetch 실패해도 정적만 리턴 (sitemap은 절대
  // 500을 던지면 안 됨 — 검색엔진이 인덱싱을 포기함).
  try {
    const supabase = await createClient()
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('is_published', true)
    // 조회 실패를 '글 없음'으로 읽지 않는다(AGENTS 규칙1) — 고정 화면만 내고 기록을 남긴다.
    if (error) {
      console.error('[sitemap] blog_posts 조회 실패', error.message)
      return staticRoutes
    }

    const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      // updated_at은 수정 시각, published_at은 게시 시각 — 둘 중 최신.
      lastModified: new Date(
        Math.max(
          p.updated_at ? new Date(p.updated_at).getTime() : 0,
          p.published_at ? new Date(p.published_at).getTime() : 0,
          0,
        ) || now.getTime(),
      ),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    return [...staticRoutes, ...postRoutes]
  } catch {
    return staticRoutes
  }
}
