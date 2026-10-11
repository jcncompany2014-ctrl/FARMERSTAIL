import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import ProductDetail from '@/components/store/ProductDetail'
import { storeSalesPaused } from '@/lib/store/toss-widget'
import {
  RECIPE_PRODUCT_NAME,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  kcalPer100g,
  recipeFromSlug,
  recipeIntro,
  storeItem,
} from '@/lib/store/catalog'
import { fetchRecipeLabel } from '@/lib/store/label'
import { shippingFeeFor } from '@/lib/store/shipping'
import JsonLd from '@/components/JsonLd'
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'

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
  // 화면 제목은 루트 틀이 ' | 파머스테일'을 붙인다 — 공유 미리보기(openGraph)엔 틀이 안 붙어 브랜드를 직접 단다.
  const title = `${RECIPE_PRODUCT_NAME[r]} 500g ${won(item.price)}원`
  const description = `${recipeIntro(r)}. 100g 팩 5개, 얼린 채로 화·목 출고.`
  return {
    title,
    description,
    alternates: { canonical: `/store/${r}` },
    openGraph: { title: `${title} | 파머스테일`, description, type: 'website', locale: 'ko_KR', siteName: '파머스테일', url: `/store/${r}`, images: [{ url: RECIPE_STUDIO_IMG[r], width: 800, height: 800 }] },
    // twitter 도 자기 것 — 없으면 루트(홈) 카드를 물려받았다(2026-10-12 점검: /store/duck 의 twitter:title 이 홈 제목).
    twitter: { card: 'summary_large_image', title: `${title} | 파머스테일`, description, images: [RECIPE_STUDIO_IMG[r]] },
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
  // ★자사몰 결제 막음(규칙177) 동안엔 '이 페이지에서 지금 살 수 있다'(offers — 재고·배송·반품)를 내보내지 않는다. 화면은 "자사몰
  //   결제는 아직 준비 중"인데 구조화 데이터만 InStock 이면 구글 판매자 정보·AI 답이 여기서 바로 주문하라고 안내한다(2026-10-12 점검).
  //   상품 정보(이름·설명·열량·보관)는 그대로 두고, 결제가 열리면(storeSalesPaused=false) offers 가 저절로 돌아온다.
  const paused = storeSalesPaused()
  // 상품 구조화 데이터(검색 결과의 가격 표시) — 후기가 생기기 전이라 평점은 넣지 않는다.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: RECIPE_PRODUCT_NAME[recipe],
    description: recipeIntro(recipe),
    image: `${SITE}${RECIPE_STUDIO_IMG[recipe]}`,
    brand: { '@type': 'Brand', name: '파머스테일' },
    sku: label?.sku ?? undefined,
    // 2026-10-11 SEO·GEO: 100g 열량·보관을 숫자로(AI 가 화면 글을 다시 해석하지 않아도 되게). 값은 정본(catalog·상품 화면 '보관')과 같다.
    additionalProperty: [
      { '@type': 'PropertyValue', name: '100g당 열량', value: kcalPer100g(recipe), unitText: 'kcal' },
      { '@type': 'PropertyValue', name: '보관', value: '냉동 180일' },
    ],
    ...(paused ? {} : { offers: [item500, item1k].map((it) => ({
      '@type': 'Offer',
      name: it.name,
      price: it.price,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: `${SITE}/store/${recipe}`,
      seller: { '@id': `${SITE}/#organization` },
      // 배송비는 정본(shippingFeeFor — 5만 원 이상 무료)으로 상품마다. 출고 = 화·목(주문 다음 첫 화·목 → 1~5일), 출고 후 1~2일.
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: shippingFeeFor(it.price), currency: 'KRW' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
        },
      },
      // 환불 정책과 같은 말 — 받은 날부터 7일 안·뜯지 않은 상품, 반품 배송비는 회원 부담(/legal/refund).
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'KR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnShippingFees',
      },
    })) }),
  }
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '스토어', path: '/store' },
    { name: RECIPE_PRODUCT_NAME[recipe], path: `/store/${recipe}` },
  ])
  return (
    <StoreShell header={{ variant: 'back', backHref: '/store' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <JsonLd id={`ld-breadcrumb-store-${recipe}`} data={breadcrumbLd} />
      <ProductDetail recipe={recipe} label={label} paused={storeSalesPaused()} />
    </StoreShell>
  )
}
