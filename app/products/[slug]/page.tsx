import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from './ProductDetailClient'
import ProductLongDesc from '@/components/products/ProductLongDesc'
import ProductFoodInfo, {
  type NutritionFacts,
} from '@/components/products/ProductFoodInfo'
import RelatedProducts from '@/components/products/RelatedProducts'
import ProductQA from '@/components/products/ProductQA'
import type { CatalogProduct } from '@/components/products/CatalogProductCard'
import JsonLd from '@/components/JsonLd'
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld'
import { isAppContextServer } from '@/lib/app-context'

/**
 * PDP 캐싱 — 서버 렌더는 공개 콘텐츠(가격·설명·이미지)만 다룬다. 개인화(찜/
 * 정기배송 토글 등)는 ProductDetailClient 가 클라이언트에서 담당하므로 RSC
 * 레벨은 60 초 revalidate 로 ISR. 관리자 편집 후 최대 1분이면 반영되고,
 * 그 사이엔 CDN/Next 데이터캐시가 요청을 완전히 삼킨다.
 * (이전: force-dynamic — 모든 방문마다 Supabase 왕복 + HTML 재생성.)
 */
export const revalidate = 60

type Params = Promise<{ slug: string }>

// 같은 요청 내에서 중복 쿼리 방지
const getProduct = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(
      `id, name, slug, description, short_description, meta_description,
       price, sale_price, category, is_subscribable, stock, image_url,
       gallery_urls, tags,
       origin, manufacturer, manufacturer_address, manufacture_date_policy,
       shelf_life_days, net_weight_g, ingredients, nutrition_facts,
       allergens, storage_method, feeding_guide, pet_food_class,
       certifications, country_of_packaging`,
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  return data
})

/**
 * 리뷰 aggregate — JSON-LD AggregateRating 주입용. 리뷰가 0개면 null 을 반환해
 * 빈 aggregate 가 검색 결과에 드러가지 않게 한다 (Google 의 경고 대상).
 * 테이블이 없거나 RLS 에서 거부당해도 조용히 null 로 후퇴.
 */
const getReviewAggregate = cache(
  async (
    productId: string,
  ): Promise<{ ratingValue: number; reviewCount: number } | null> => {
    const supabase = await createClient()
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', productId)
        .eq('is_published', true)
      if (error || !data || data.length === 0) return null
      const ratings = data
        .map((r) => Number((r as { rating: number | null }).rating))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (ratings.length === 0) return null
      const avg = ratings.reduce((s, n) => s + n, 0) / ratings.length
      return { ratingValue: avg, reviewCount: ratings.length }
    } catch {
      return null
    }
  },
)

/**
 * variant 쿼리는 **별도 분리** — 마이그레이션이 배포 환경에 아직 적용 안 된
 * 상태에서도 PDP 가 죽지 않게. 테이블 부재/권한 오류는 조용히 빈 배열로 처리.
 */
const getVariants = cache(async (productId: string) => {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('product_variants')
      .select(
        'id, product_id, sku, name, option_values, price, sale_price, stock, position, is_active'
      )
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('position', { ascending: true })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
})

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return {
      title: '제품을 찾을 수 없음',
      description: '요청하신 제품을 찾을 수 없습니다.',
    }
  }

  const price = product.sale_price ?? product.price
  const priceLabel = `${price.toLocaleString()}원`
  const description =
    product.meta_description ??
    product.short_description ??
    product.description?.slice(0, 120) ??
    `${product.name} — 파머스테일의 프리미엄 반려견 식품. ${priceLabel}`

  // Always build a branded fallback OG card via /api/og so Kakao share cards
  // are consistent even when product.image_url is missing or slow to load.
  const ogFallback = `/api/og?variant=product&title=${encodeURIComponent(
    product.name
  )}&subtitle=${encodeURIComponent(
    (product.short_description ?? priceLabel).slice(0, 100)
  )}&tag=${encodeURIComponent(product.category ?? 'Product')}`

  const ogImages = product.image_url
    ? [
        { url: product.image_url, alt: product.name },
        { url: ogFallback, width: 1200, height: 630, alt: product.name },
      ]
    : [{ url: ogFallback, width: 1200, height: 630, alt: product.name }]

  return {
    title: product.name,
    description,
    alternates: {
      canonical: `/products/${slug}`,
    },
    openGraph: {
      type: 'website',
      title: `${product.name} | 파머스테일`,
      description,
      url: `/products/${slug}`,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | 파머스테일`,
      description,
      images: ogImages.map((img) => img.url),
    },
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Params
}) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return (
      <main
        className="min-h-[70vh] px-5 py-16 max-w-md mx-auto flex items-center"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="w-full rounded-2xl py-14 flex flex-col items-center text-center"
          style={{
            background: 'var(--bg-2)',
            border: '1px dashed var(--rule-2)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'var(--bg)' }}
          >
            <Search
              className="w-5 h-5"
              strokeWidth={1.8}
              color="var(--muted)"
            />
          </div>
          <span className="kicker kicker-muted">Not Found · 찾을 수 없음</span>
          <p
            className="font-serif mt-2 text-[15px] font-black"
            style={{ color: 'var(--text)' }}
          >
            제품을 찾을 수 없어요
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center py-3 px-5 rounded-full text-[12px] font-bold transition active:scale-[0.98]"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
            }}
          >
            제품 목록으로
          </Link>
        </div>
      </main>
    )
  }

  const supabase = await createClient()
  const isApp = await isAppContextServer()
  const [variants, rating, relatedRaw, userRes] = await Promise.all([
    getVariants(product.id),
    getReviewAggregate(product.id),
    // 같은 카테고리의 다른 active 상품 (현재 상품 제외) — 함께 보면 좋은 상품.
    product.category
      ? supabase
          .from('products')
          .select(
            'id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock, created_at',
          )
          .eq('is_active', true)
          .eq('category', product.category)
          .neq('id', product.id)
          .order('sort_order', { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] as CatalogProduct[] }),
    supabase.auth.getUser(),
  ])
  const related = ((relatedRaw.data ?? []) as CatalogProduct[]).slice(0, 4)
  const isAuthed = !!userRes.data.user

  // JSON-LD 이미지 배열 — 절대 URL 로 정규화. image_url 이 외부 URL 이면 그대로,
  // 상대경로면 SITE_URL 로 prefix.
  const absolutize = (u: string) =>
    u.startsWith('http') ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`
  const images = [
    product.image_url ? absolutize(product.image_url) : null,
    ...(Array.isArray(product.gallery_urls)
      ? product.gallery_urls.map((u: string) => absolutize(u))
      : []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0)

  const productLd = buildProductJsonLd({
    name: product.name,
    slug: product.slug,
    description:
      product.meta_description ??
      product.short_description ??
      product.description?.slice(0, 300) ??
      product.name,
    image: images.length > 0 ? images : [`${SITE_URL}/api/og`],
    price: product.price,
    salePrice: product.sale_price ?? null,
    inStock: (product.stock ?? 0) > 0,
    sku: variants[0]?.sku ?? product.slug,
    category: product.category ?? undefined,
    aggregateRating: rating ?? undefined,
  })

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '제품', path: '/products' },
    { name: product.name, path: `/products/${product.slug}` },
  ])

  // Chrome 은 layout (AuthAwareShell → WebChrome) 가 이미 처리.
  return (
    <>
      <JsonLd id={`ld-product-${product.slug}`} data={productLd} />
      <JsonLd id={`ld-breadcrumb-${product.slug}`} data={breadcrumbLd} />
      <ProductDetailClient
        product={product}
        variants={variants}
        isApp={isApp}
        longDescSlot={
          isApp ? null : (
            <>
              <ProductLongDesc
                description={product.description}
                category={product.category}
              />
              {/* 전자상거래법 §13 + 사료관리법 표시 — 항상 노출. 컬럼이 비어
                  있으면 자동으로 "정보 준비 중" 표시되어 운영자가 미입력
                  상품을 시각적으로 인지 가능. */}
              <ProductFoodInfo
                origin={product.origin}
                manufacturer={product.manufacturer}
                manufacturerAddress={product.manufacturer_address}
                manufactureDatePolicy={product.manufacture_date_policy}
                shelfLifeDays={product.shelf_life_days}
                netWeightG={product.net_weight_g}
                ingredients={product.ingredients}
                nutritionFacts={product.nutrition_facts as NutritionFacts | null}
                allergens={product.allergens}
                storageMethod={product.storage_method}
                feedingGuide={product.feeding_guide}
                petFoodClass={product.pet_food_class}
                certifications={product.certifications}
                countryOfPackaging={product.country_of_packaging}
              />
            </>
          )
        }
        relatedSlot={isApp ? null : <RelatedProducts products={related} />}
        qnaSlot={
          isApp ? null : (
            <ProductQA
              productId={product.id}
              productSlug={product.slug}
              isAuthed={isAuthed}
            />
          )
        }
      />
    </>
  )
}
