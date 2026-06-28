import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, Phone, ArrowRight } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import { business } from '@/lib/business'
import ContactForm from './ContactForm'
import { Container, Display, Eyebrow, Section } from '@/components/web/fd/ui'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'

const CONTACT_OG = ogImageUrl({
  title: '문의하기',
  subtitle: '제품·주문·정기배송·반품 무엇이든',
  tag: 'Contact',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차148).
  title: '문의하기',
  description:
    '제품·주문·정기배송·반품 등 어떤 문의든 보내주세요. 평일 영업일 24시간 이내 답변드립니다.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: '문의하기 | 파머스테일',
    description:
      '제품·주문·정기배송·반품 등 어떤 문의든 보내주세요. 평일 영업일 24시간 이내 답변드립니다.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/contact',
    images: [{ url: CONTACT_OG, width: 1200, height: 630, alt: '문의하기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '문의하기 | 파머스테일',
    description:
      '제품·주문·정기배송·반품 등 어떤 문의든 보내주세요. 평일 영업일 24시간 이내 답변드립니다.',
    images: [CONTACT_OG],
  },
  robots: { index: true, follow: true },
}

/**
 * /contact — 1:1 문의 폼 + 채널 안내 (farm v6 = FD 톤 리스타일, 2026-06-13).
 * 폼 로직(ContactForm client·/api/contact·honeypot·rate-limit)·AuthAwareShell 보존,
 * 페이지 셸만 FD 톤. ContactForm 컴포넌트는 미수정.
 */
export default function ContactPage() {
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '문의하기', path: '/contact' },
  ])
  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-contact-crumbs" data={crumbLd} />
        {/* Hero */}
        <Section bg="offwhite" pad="sm">
          <Container size="md">
            <Eyebrow>CONTACT</Eyebrow>
            <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              궁금한 점이 있다면
            </Display>
            <p className="pt-4 text-[14px] md:text-[16px]" style={{ color: 'var(--fd-muted)', maxWidth: 520, lineHeight: 1.65 }}>
              제품·주문·정기배송·반품 — 무엇이든 적어 보내주세요. 평일 영업일
              24시간 이내, 가능하면 더 빨리 답변드립니다.
            </p>
          </Container>
        </Section>

        {/* 빠른 채널 + 폼 */}
        <Section bg="cream" pad="md">
          <Container size="md">
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <Channel Icon={Mail} label="이메일" value={business.email} href={`mailto:${business.email}`} />
              <Channel Icon={Phone} label="전화" value={business.phone} href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} note="평일 10:00 – 18:00" />
              {business.kakaoChannelUrl && (
                <Channel Icon={MessageCircle} label="카카오 채널" value="1:1 채팅" href={business.kakaoChannelUrl} external />
              )}
            </ul>

            <div className="mt-8">
              <Eyebrow color="var(--fd-coral)">MESSAGE</Eyebrow>
              <div
                className="mt-4 px-5 py-6 md:px-8 md:py-8"
                style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8 }}
              >
                <Suspense fallback={null}>
                  <ContactForm />
                </Suspense>
              </div>
            </div>

            {/* FAQ 안내 */}
            <Link
              href="/faq"
              className="mt-6 flex items-center justify-between gap-3 no-underline"
              style={{ background: 'var(--fd-offwhite)', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '16px 18px' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>
                  먼저 자주 묻는 질문도 확인해 보세요
                </p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--fd-muted)' }}>
                  식단·배송·결제·정기배송 관련 답변이 모여 있어요.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 shrink-0 text-[13px]" style={{ color: 'var(--fd-coral-text)', fontWeight: 800 }}>
                FAQ <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </span>
            </Link>
          </Container>
        </Section>
      </main>
    </WebChrome>
  )
}

function Channel({
  Icon,
  label,
  value,
  href,
  note,
  external,
}: {
  Icon: typeof Mail
  label: string
  value: string
  href?: string
  note?: string
  external?: boolean
}) {
  return (
    <li>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="block no-underline transition hover:opacity-90 h-full"
        style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '16px 18px' }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 shrink-0" strokeWidth={2} color="var(--fd-coral)" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)', textTransform: 'uppercase' }}>
            {label}
          </span>
        </div>
        <div className="mt-2 text-[15px] break-all" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>
          {value}
        </div>
        {note && <div className="mt-1 text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>{note}</div>}
      </a>
    </li>
  )
}
