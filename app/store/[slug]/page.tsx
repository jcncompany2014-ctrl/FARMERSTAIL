import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import ProductDetail from '@/components/store/ProductDetail'
import {
  RECIPE_PRODUCT_NAME,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  recipeFromSlug,
  recipeIntro,
  storeItem,
} from '@/lib/store/catalog'
import { fetchRecipeLabel } from '@/lib/store/label'

/**
 * 상품 상세 — /store/chicken·duck·pork·beef (웹 시안 Product). /store/trial 은 스토어 체험팩 탭으로.
 * 라벨(제공고시)은 DB 에서 읽고 1시간마다 다시 만든다. 출고일은 브라우저 시계(useShipDate).
 */
export const revalidate = 3600

export function generateStaticParams() {
  return STORE_RECIPES.map((slug) => ({ slug }))
}

const won = (n: number) => n.toLocaleString('ko-KR')
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const r = recipeFromSlug(slug)
  if (!r) return {}
  const item = storeItem(`${r}-500g`)
  const title = `${RECIPE_PRODUCT_NAME[r]} 500g ${won(item.price)}원 | 파머스테일`
  const description = `${recipeIntro(r)}. 100g 팩 5개, 얼린 채로 화·목 출고.`
  return {
    title,
    description,
    alternates: { canonical: `/store/${r}` },
    openGraph: { title, description, type: 'website', locale: 'ko_KR', siteName: '파머스테일', url: `/store/${r}`, images: [{ url: RECIPE_STUDIO_IMG[r], width: 800, height: 800 }] },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === 'trial') redirect('/store?tab=trial')
  const recipe = recipeFromSlug(slug)
  if (!recipe) notFound()
  const label = await fetchRecipeLabel(recipe)
  const item500 = storeItem(`${recipe}-500g`)
  const item1k = storeItem(`${recipe}-1kg`)
  // 상품 구조화 데이터(검색 결과의 가격 표시) — 후기가 생기기 전이라 평점은 넣지 않는다.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: RECIPE_PRODUCT_NAME[recipe],
    description: recipeIntro(recipe),
    image: `${SITE}${RECIPE_STUDIO_IMG[recipe]}`,
    brand: { '@type': 'Brand', name: '파머스테일' },
    sku: label?.sku ?? undefined,
    offers: [item500, item1k].map((it) => ({
      '@type': 'Offer',
      name: it.name,
      price: it.price,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      url: `${SITE}/store/${recipe}`,
    })),
  }
  return (
    <StoreShell header={{ variant: 'back', backHref: '/store' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProductDetail recipe={recipe} label={label} />
    </StoreShell>
  )
}
