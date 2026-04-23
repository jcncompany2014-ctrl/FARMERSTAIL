import type { Metadata } from 'next'
import Link from 'next/link'
import { cache } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from './ProductDetailClient'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>

// 같은 요청 내에서 중복 쿼리 방지
const getProduct = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(
      'id, name, slug, description, short_description, meta_description, price, sale_price, category, is_subscribable, stock, image_url, gallery_urls, tags'
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  return data
})

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

  const variants = await getVariants(product.id)

  return <ProductDetailClient product={product} variants={variants} />
}
