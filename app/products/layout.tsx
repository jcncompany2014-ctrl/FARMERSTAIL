import type { Metadata } from 'next'
import AuthAwareShell from '@/components/AuthAwareShell'
import { ogImageUrl } from '@/lib/seo/jsonld'

/**
 * ⚠️ /products 는 **리다이렉트 스텁**이다 — 구독 전용 전환(2026-06-26)으로 낱개
 * 카탈로그를 폐지하고 `/start` 로 보낸다. page 가 redirect() 하므로 이 메타는
 * 실제로 렌더되지 않는다.
 *
 * 그런데 문구가 팔지 않는 제품 세 가지를 나열하고 있었다(2026-07-31 사장님:
 * "출시 안 했는데 영양제가 보인다"). robots 도 `index: true` 라, 되살아나면
 * 없는 제품을 광고하며 색인되라고 말하는 상태였다.
 * 사실에 맞추고 noindex 로 둔다. 카탈로그가 부활하면 그때 다시 쓴다.
 */
const PRODUCTS_OG = ogImageUrl({
  title: '제품 카탈로그',
  subtitle: '수의영양학 기반 레시피 · 우리 아이 맞춤 화식',
  tag: 'Products',
  variant: 'product',
})

export const metadata: Metadata = {
  title: '제품',
  description:
    '파머스테일 — 수의영양학 기반 레시피로 만든 우리 아이 맞춤 화식 정기배송. 농장에서 꼬리까지.',
  alternates: { canonical: '/products' },
  openGraph: {
    type: 'website',
    url: '/products',
    title: '제품 | 파머스테일',
    description:
      '수의영양학 기반 레시피로 만든 우리 아이 맞춤 화식 정기배송.',
    images: [{ url: PRODUCTS_OG, width: 1200, height: 630, alt: '제품 카탈로그' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '제품 | 파머스테일',
    description:
      '수의영양학 기반 레시피로 만든 우리 아이 맞춤 화식 정기배송.',
    images: [PRODUCTS_OG],
  },
  // 리다이렉트 스텁이라 색인 대상이 아니다.
  robots: { index: false, follow: true },
}

/**
 * /products is the one route that legitimately serves both audiences:
 *   - Unauth visitors browsing the catalog as marketing content
 *   - Signed-in users shopping inside the installed PWA
 *
 * The AuthAwareShell picks the right wrapper on the server. Content pages
 * below stay audience-agnostic — add-to-cart / wishlist logic inside
 * ProductDetailClient already handles the unauth case by redirecting to
 * /login, so we don't need separate views yet.
 *
 * When marketing copy + photography lands per product, the unauth view
 * can graduate to a magazine-style editorial layout; for now, both
 * audiences see the same grid / detail, just framed by different chrome.
 */
export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthAwareShell>{children}</AuthAwareShell>
}
