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

/** 사이트 전역 기본값 — NEXT_PUBLIC_SITE_URL 이 없으면 Vercel preview URL 로 fallback. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.vercel.app'

const SITE_NAME = '파머스테일'
const SITE_NAME_EN = "Farmer's Tail"
const LOGO_URL = `${SITE_URL}/icons/icon-512.png`

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
    sameAs: [
      'https://www.instagram.com/farmerstail',
      'https://blog.naver.com/farmerstail',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'KR',
      availableLanguage: ['Korean'],
      email: 'hello@farmerstail.com',
    },
  } as const
}

/**
 * WebSite 스키마 — Google 의 sitelinks search box 지원. 사용자가 브랜드명으로
 * 검색할 때 결과 카드 안에 검색창을 띄워 주는 기능.
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
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  } as const
}

export type ProductJsonLdInput = {
  name: string
  slug: string
  description: string
  image: string[]
  price: number
  salePrice?: number | null
  /** 실제 재고가 있으면 InStock, 아니면 OutOfStock. */
  inStock: boolean
  /** product_variants.sku 대표값 등. 없으면 slug 로 대체. */
  sku?: string
  /** 카테고리 경로 (예: "반려견 식품 > 화식") */
  category?: string
  /** ≥1 이상의 리뷰가 존재할 때만. 없으면 undefined. */
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  }
  /** 할인 종료 시간이 확정되어 있으면 ISO 8601. */
  priceValidUntil?: string
}

/**
 * Product 스키마 — Google Shopping 리치리절트 eligibility.
 * 가격 · 재고 · 이미지 · SKU 가 모두 들어가면 별점과 가격이 검색결과에 노출된다.
 */
export function buildProductJsonLd(input: ProductJsonLdInput) {
  const finalPrice = input.salePrice ?? input.price
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    priceCurrency: 'KRW',
    price: finalPrice,
    availability: input.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    url: `${SITE_URL}/products/${input.slug}`,
    // 판매자 (자체 D2C) — Google 이 "파는 주체" 를 명시하길 권장.
    seller: { '@type': 'Organization', name: SITE_NAME },
  }
  if (input.priceValidUntil) {
    offer.priceValidUntil = input.priceValidUntil
  }

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
    sku: input.sku ?? input.slug,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: offer,
  }
  if (input.category) {
    data.category = input.category
  }
  if (input.aggregateRating && input.aggregateRating.reviewCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.aggregateRating.ratingValue.toFixed(1),
      reviewCount: input.aggregateRating.reviewCount,
      bestRating: '5',
      worstRating: '1',
    }
  }
  return data
}

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
