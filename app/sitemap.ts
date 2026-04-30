import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.vercel.app'

export const revalidate = 3600 // 1시간마다 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 정적 페이지
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // 에디토리얼 마케팅 서브루트 — 브랜드 이야기 · 정기배송 플랜.
    // 랜딩과 함께 서치 인덱싱이 필요한 공개 페이지.
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/brand`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/collections`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // 판매 동선 alias — /products?sort=best 등을 short URL 로.
    {
      url: `${siteUrl}/best`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/new`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/plans`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // 신규 콘텐츠 페이지 — 산지 / FAQ / 뉴스레터 / 과학 alias / 이벤트 인덱스
    {
      url: `${siteUrl}/partners`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/newsletter`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/events`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/science`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // login / signup 은 robots.ts 에서 disallow — sitemap 에 포함하면
    // GSC 가 "Submitted URL blocked by robots.txt" 경고를 내고 문서 자체에도
    // 모순. 제거.
    // 법정 필수 표기 페이지 — 검색엔진이 찾을 수 있게 포함.
    // 변경 빈도 낮고 우선순위도 낮지만 크롤됐다는 사실이 App Store /
    // 규제기관 관점에서 "공개했다"의 증거가 된다.
    {
      url: `${siteUrl}/business`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal/refund`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // 동적 페이지 — Supabase fetch 실패해도 정적만 리턴 (sitemap은 절대
  // 500을 던지면 안 됨. 검색엔진이 인덱싱을 포기함).
  try {
    const supabase = await createClient()

    // 병렬로 products + blog posts + blog categories + collections 쿼리.
    // collections 는 마이그레이션이 아직 안 적용된 환경에서도 안전하게 처리.
    type CollectionRow = { slug: string; updated_at: string | null }
    const collectionsPromise: Promise<{ data: CollectionRow[] | null }> =
      (async () => {
        try {
          const r = await supabase
            .from('collections')
            .select('slug, updated_at')
            .eq('is_published', true)
          return {
            data: (r.data ?? null) as CollectionRow[] | null,
          }
        } catch {
          return { data: null }
        }
      })()

    type EventRow = { slug: string; updated_at: string | null }
    const eventsPromise: Promise<{ data: EventRow[] | null }> = (async () => {
      try {
        const r = await supabase
          .from('events')
          .select('slug, updated_at')
          .eq('is_active', true)
        return { data: (r.data ?? null) as EventRow[] | null }
      } catch {
        return { data: null }
      }
    })()

    const [
      { data: products },
      { data: posts },
      { data: categories },
      { data: collections },
      { data: events },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('slug, updated_at')
        .eq('is_active', true),
      supabase
        .from('blog_posts')
        .select('slug, updated_at, published_at')
        .eq('is_published', true),
      supabase.from('blog_categories').select('slug'),
      collectionsPromise,
      eventsPromise,
    ])

    const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url: `${siteUrl}/products/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${siteUrl}/blog/${p.slug}`,
      // updated_at은 수정 시각, published_at은 게시 시각 — 둘 중 최신
      // (수정이 없었으면 published_at이 곧 lastmod)
      lastModified: new Date(
        Math.max(
          p.updated_at ? new Date(p.updated_at).getTime() : 0,
          p.published_at ? new Date(p.published_at).getTime() : 0,
          0
        ) || now.getTime()
      ),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    // /blog?category=slug 는 query string canonical 처리가 모호해 GSC 에서
    // 중복 콘텐츠 / "Crawled — currently not indexed" 경고를 자주 받음.
    // sitemap 제외 — 카테고리는 메인 /blog 에서 navigation 으로 도달.
    // 추후 /blog/category/[slug] 같은 path 기반 라우트로 옮기면 다시 포함.
    const categoryRoutes: MetadataRoute.Sitemap = []
    void categories // 미사용 변수 lint silence — 향후 path 기반 라우팅 시 복구 자료

    const collectionRoutes: MetadataRoute.Sitemap = (collections ?? []).map(
      (c) => ({
        url: `${siteUrl}/collections/${c.slug}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }),
    )

    const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
      url: `${siteUrl}/events/${e.slug}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    return [
      ...staticRoutes,
      ...productRoutes,
      ...postRoutes,
      ...categoryRoutes,
      ...collectionRoutes,
      ...eventRoutes,
    ]
  } catch {
    return staticRoutes
  }
}
