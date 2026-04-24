import type { Metadata } from 'next'
import AuthAwareShell from '@/components/AuthAwareShell'

/**
 * 카탈로그 리스트 (/products) 의 기본 메타. /products/[slug] 는 자체
 * generateMetadata 로 덮어쓴다 — Next metadata 는 layout → page 순으로 병합
 * 되며 같은 필드는 page 값이 우선한다. OG 카드에는 공통 브랜드 이미지
 * (`/api/og`) 를 써 카카오 공유 미리보기가 일관되게 보이도록 한다.
 */
export const metadata: Metadata = {
  title: '제품',
  description:
    '파머스테일 전체 제품 카탈로그 — 수의영양학 기반 레시피로 만든 화식, 간식, 체험팩. 농장에서 꼬리까지.',
  alternates: { canonical: '/products' },
  openGraph: {
    type: 'website',
    url: '/products',
    title: '제품 | 파머스테일',
    description:
      '수의영양학 기반 레시피로 만든 프리미엄 반려견 식품 — 화식, 간식, 체험팩.',
  },
  twitter: {
    card: 'summary_large_image',
    title: '제품 | 파머스테일',
    description:
      '수의영양학 기반 레시피로 만든 프리미엄 반려견 식품 — 화식, 간식, 체험팩.',
  },
  robots: { index: true, follow: true },
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
