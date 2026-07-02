/**
 * JSON-LD schema builders (schema.org).
 *
 * Google / Naver / Kakao 검색 결과의 rich result 파싱을 위한 structured data.
 * 각 helper 는 이미 schema.org 에서 정의된 타입만 사용하며, 값이 없는 필드는
 * 객체에 포함하지 않아 린트 타입가드를 쉽게 통과하도록 작성했다.
 *
 * 사용 패턴
 * ────────
 *   import { buildProductJsonLd } from '@/lib/seo/jsonld'
 *   import JsonLd from '@/components/JsonLd'
 *
 *   const data = buildProductJsonLd({ ... })
 *   return (
 *     <>
 *       <JsonLd data={data} />
 *       ...
 *     </>
 *   )
 *
 * 주의
 * ────
 * · Google 의 product 리치리절트는 `offers.priceValidUntil` 이 없으면 "권장
 *   속성 누락" 을 표시하지만 eligibility 는 통과한다. 할인 종료 시각이 실제로
 *   있을 때만 넣어 false positive 를 피한다.
 * · AggregateRating 은 ≥1 개의 실제 리뷰가 있을 때만 포함 — 빈 aggregate 는
 *   Search Console 에서 경고로 잡힌다.
 */

/** 사이트 전역 기본값 — NEXT_PUBLIC_SITE_URL 이 없으면 운영 도메인으로 fallback.
 * 도메인 미연결 환경에선 NEXT_PUBLIC_SITE_URL 을 명시적으로 Vercel preview 등으로
 * 덮어 써야 한다 (LAUNCH_CHECKLIST.md 의 env 표 참고).
 *
 * canonical 은 www 포함 (app/layout.tsx, app/sitemap.ts, app/robots.ts 와 통일).
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

/**
 * /api/og 의 dynamic share card URL 을 만들어 주는 헬퍼.
 *
 * metadata.openGraph.images 에 상대경로를 넣으면 layout 의 metadataBase 가
 * 자동으로 절대 URL 로 붙여 주므로 여기서는 path + query 만 조립한다.
 *
 * variant:
 *   • 'default'   → 테라코타 accent (브랜드 일반)
 *   • 'product'   → 올리브 accent   (제품 상세/리스트)
 *   • 'editorial' → 골드 accent     (매거진/브랜드 이야기)
 */
export function ogImageUrl(input: {
  title: string
  subtitle?: string
  tag?: string
  variant?: 'default' | 'product' | 'editorial'
}): string {
  const params = new URLSearchParams()
  params.set('title', input.title.slice(0, 80))
  if (input.subtitle) params.set('subtitle', input.subtitle.slice(0, 120))
  if (input.tag) params.set('tag', input.tag.slice(0, 40))
  if (input.variant && input.variant !== 'default') {
    params.set('variant', input.variant)
  }
  return `/api/og?${params.toString()}`
}

const SITE_NAME = '파머스테일'
const SITE_NAME_EN = "Farmer's Tail"
const LOGO_URL = `${SITE_URL}/icons/icon-512.png`

/**
 * 브랜드 공식 소셜/채널 — SSOT.
 * Organization JSON-LD 의 `sameAs`(검색엔진 동일-엔티티 병합)와 FdFooter 의
 * "Connect" 가 이 한 배열을 공유한다. 새 채널 추가/변경 시 여기 한 곳만 수정하면
 * 구조화데이터와 푸터가 동시에 갱신된다. (가짜 채널 금지 — 실재 계정만.)
 */
export const SOCIAL_PROFILES: { label: string; href: string }[] = [
  { label: 'Instagram', href: 'https://www.instagram.com/farmerstail' },
  { label: '네이버 블로그', href: 'https://blog.naver.com/farmerstail' },
]

/**
 * Organization + LocalBusiness 혼합 스키마. 브랜드 검색 시 Knowledge Panel 에
 * 노출될 핵심 정보. sameAs 에 SNS 링크가 있으면 동일 엔티티로 병합해준다.
 */
export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    logo: LOGO_URL,
    description:
      '수의영양학 기반 레시피로 만든 프리미엄 반려견 식품 브랜드. Farm to Tail.',
    sameAs: SOCIAL_PROFILES.map((s) => s.href),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'KR',
      availableLanguage: ['Korean'],
      email: 'story@farmerstail.kr',
    },
  } as const
}

/**
 * WebSite 스키마.
 *
 * SearchAction(sitelinks search box) 은 제거(2026-07-03 감사) — 대상이던
 * /products 검색이 구독전용 전환으로 폐지(→/start redirect, 쿼리 증발)됐고,
 * Google 도 2024-10 부로 사이트링크 검색박스 지원을 종료함.
 */
export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${SITE_URL}/#organization` },
  } as const
}

// buildProductJsonLd(Product 리치리절트 빌더)는 2026-07-03 감사에서 제거 —
// 호출처 0(죽은 export)인 데다 offer.url 이 폐지된 /products/[slug] 를 가리켰음.
// 구독 상품 LD 가 필요해지면 /subscribe 경로 기준으로 새로 설계할 것.

export type BreadcrumbItem = {
  name: string
  /** 절대/상대 경로 모두 허용. 내부에서 SITE_URL prefix 붙여 절대화. */
  path: string
}

/**
 * BreadcrumbList — 검색결과 URL 위에 "홈 > 제품 > 화식" 같은 path 노출.
 * 첫 항목은 반드시 홈이라야 Google 이 "brand bar" 로 인식한다.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.path.startsWith('http')
        ? item.path
        : `${SITE_URL}${item.path.startsWith('/') ? '' : '/'}${item.path}`,
    })),
  } as const
}

export type ArticleJsonLdInput = {
  title: string
  slug: string
  description: string
  coverUrl: string | null
  publishedAt: string | null
  updatedAt?: string | null
  /** 기본 author = 브랜드. 게스트 작가가 있으면 넣는다. */
  authorName?: string
}

/**
 * Article 스키마 — 매거진 글. Google Top Stories / Discover 피드 eligibility.
 * datePublished 가 없으면 자격을 잃으므로 반드시 ISO-8601 로 넣는다.
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title.slice(0, 110), // 110자 초과 시 Google 이 drop.
    description: input.description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${input.slug}`,
    },
    author: {
      '@type': input.authorName ? 'Person' : 'Organization',
      name: input.authorName ?? SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: LOGO_URL },
    },
  }
  if (input.coverUrl) {
    data.image = [input.coverUrl]
  }
  if (input.publishedAt) {
    data.datePublished = input.publishedAt
  }
  if (input.updatedAt) {
    data.dateModified = input.updatedAt
  } else if (input.publishedAt) {
    data.dateModified = input.publishedAt
  }
  return data
}

export type FaqItem = {
  question: string
  answer: string
}

/**
 * FAQPage — 자주 묻는 질문. 문답이 3개 이상일 때만 의미있고 Google 이 가끔
 * 결과 카드 아래 accordion 을 달아준다. 답변은 HTML 허용.
 */
export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } as const
}

/**
 * ItemList — 컬렉션 / 카탈로그 모음 grid 의 검색 결과 향상.
 * Google rich result 의 carousel 자격 (정확한 가격 / 이미지 동반 시).
 */
export function buildItemListJsonLd(input: {
  name: string
  url: string
  items: { name: string; url: string; image?: string | null }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: input.name,
    url: input.url,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((it, idx) => {
      const node: Record<string, unknown> = {
        '@type': 'ListItem',
        position: idx + 1,
        url: it.url,
        name: it.name,
      }
      if (it.image) node.image = it.image
      return node
    }),
  } as const
}

/**
 * CollectionPage — 큐레이션 컬렉션 detail 페이지.
 * mainEntity 로 ItemList 를 묶어 함께 제출.
 */
export function buildCollectionPageJsonLd(input: {
  name: string
  description?: string
  url: string
  items: { name: string; url: string; image?: string | null }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntity: buildItemListJsonLd({
      name: input.name,
      url: input.url,
      items: input.items,
    }),
  } as const
}

/**
 * AboutPage — 브랜드 / 회사 소개 페이지. /brand 가 사용.
 */
export function buildAboutPageJsonLd(input: {
  name: string
  description: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    about: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  } as const
}

/**
 * Event — 마케팅 이벤트 / 프로모션 (블랙프라이데이, 신규 출시 등).
 *
 * Google "Event" rich result 대상. 단, schema.org Event 의 본 의도는 물리적/
 * 가상 이벤트(콘서트, 컨퍼런스). 쇼핑 프로모션을 Event 로 표시하면 Google 이
 * 거부할 수 있어 organizer/location 까지 충실히 채운다.
 *
 * eventStatus / eventAttendanceMode 는 onlineSale 이라 OnlineEventAttendanceMode
 * + EventScheduled 고정. 이벤트 종료 후엔 EventScheduled 가 EventCompleted 로
 * 자동 변환되도록 endDate 가 과거면 호출처에서 status 변경 권장.
 */
export function buildEventJsonLd(input: {
  name: string
  description: string
  startDate: string // ISO 8601
  endDate: string
  url: string
  imageUrl?: string | null
}) {
  const now = Date.now()
  const ended = new Date(input.endDate).getTime() < now
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    eventStatus: ended
      ? 'https://schema.org/EventCompleted'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: input.url,
    },
    organizer: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    url: input.url,
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    isAccessibleForFree: true,
  } as const
}
