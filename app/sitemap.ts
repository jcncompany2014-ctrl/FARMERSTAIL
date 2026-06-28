import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

// R72 — production fallback 을 www. 으로 통일 (Vercel 의 primary 도메인).
// NEXT_PUBLIC_SITE_URL env 가 우선 — 셋업돼 있으면 그 값 사용.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export const revalidate = 3600 // 1시간마다 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // 정적 페이지.
  // 구독 전용 전환(2026-06-27): 낱개커머스 라우트 /products·/collections·/best·
  // /new·/events 는 /start 로 redirect 되므로 sitemap 에서 제외 — 크롤러가
  // redirect URL 을 인덱싱하면 GSC 중복/리다이렉트 경고가 나기 때문.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // 에디토리얼 마케팅 서브루트 — 브랜드 이야기 · 정기배송 플랜.
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
      url: `${siteUrl}/our-food`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // 신선식 교육 페이지 (왜 화식인가) — FD /why-fresh 대응.
    {
      url: `${siteUrl}/why-fresh`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/reviews`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/plans`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // 신규 콘텐츠 페이지 — 산지 / FAQ / 뉴스레터 / 과학 alias
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
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/newsletter`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
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
    {
      url: `${siteUrl}/business`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteUrl}/legal`,
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

  // 동적 페이지 — blog posts 만 (products/collections/events 는 구독 전환으로
  // redirect 되어 제외). Supabase fetch 실패해도 정적만 리턴 (sitemap은 절대
  // 500을 던지면 안 됨 — 검색엔진이 인덱싱을 포기함).
  try {
    const supabase = await createClient()
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('is_published', true)

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
