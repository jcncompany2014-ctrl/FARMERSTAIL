import type { Metadata } from 'next'
import AuthAwareShell from '@/components/AuthAwareShell'
import { ogImageUrl } from '@/lib/seo/jsonld'

/**
 * /events 는 /products 와 같은 이유로 AuthAwareShell:
 *   - 비로그인 방문자는 editorial 풍의 PublicPageShell 로 감싸 "마케팅 페이지" 톤
 *   - 로그인 PWA 유저는 AppChrome 으로 감싸 앱 내부 탐색 섹션으로 흡수
 *
 * 메타데이터는 layout 에 두면 /events/[slug] 가 자체 generateMetadata 로
 * 덮어쓸 수 있다 (Next 는 layout → page 병합 시 같은 필드는 page 우선).
 */
const EVENTS_OG = ogImageUrl({
  title: '진행 중인 이벤트',
  subtitle: '쿠폰 · 첫 주문 혜택 · 정기배송 런칭',
  tag: 'Events',
  variant: 'product',
})

export const metadata: Metadata = {
  title: '이벤트',
  description:
    '파머스테일의 진행 중 이벤트 — 쿠폰 발급, 첫 주문 혜택, 정기배송 런칭 프로모션까지 한눈에.',
  alternates: { canonical: '/events' },
  openGraph: {
    type: 'website',
    url: '/events',
    title: '이벤트 | 파머스테일',
    description:
      '진행 중인 모든 이벤트를 한 곳에 — 쿠폰 · 첫 주문 · 정기배송.',
    images: [{ url: EVENTS_OG, width: 1200, height: 630, alt: '이벤트' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '이벤트 | 파머스테일',
    description:
      '진행 중인 모든 이벤트를 한 곳에.',
    images: [EVENTS_OG],
  },
  robots: { index: true, follow: true },
}

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthAwareShell publicBackHref="/products" publicBackLabel="제품">
      {children}
    </AuthAwareShell>
  )
}
