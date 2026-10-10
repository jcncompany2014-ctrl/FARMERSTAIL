import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteShell from '@/components/store/SiteShell'
import { business } from '@/lib/business'
import { isAppContextServer } from '@/lib/app-context'
import ContactForm from './ContactForm'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'

const CONTACT_OG = ogImageUrl({
  title: '문의하기',
  subtitle: '제품·주문·정기배송·반품 무엇이든',
  tag: 'Contact',
  variant: 'editorial',
})

const DESCRIPTION = '제품·주문·정기배송·반품, 무엇이든 적어 보내 주세요. 영업일에는 24시간 안에 답변드려요.'

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차148).
  title: '문의하기',
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: {
    title: '문의하기 | 파머스테일',
    description: DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/contact',
    images: [{ url: CONTACT_OG, width: 1200, height: 630, alt: '문의하기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '문의하기 | 파머스테일',
    description: DESCRIPTION,
    images: [CONTACT_OG],
  },
  robots: { index: true, follow: true },
}

/**
 * /contact — 문의하기(웹 시안 WEB-C18·C18b, 2026-10-10 웹 리뉴얼 'A 포스터' 웹).
 * 연락 채널 세 줄(이메일·전화·카카오) + 메시지 양식(ContactForm — /api/contact·honeypot·한도 그대로) + 자주 묻는 질문 안내.
 * 바깥 틀은 SiteShell — 웹이면 새 웹 가게 틀, 앱이면 AppChrome(앱은 카카오 채널 주소가 비었을 때만 여기로 온다 —
 * /help·/account 의 폴백). 앱은 윗줄이 제목(문의하기)을 맡으므로 본문 머리말·큰 제목을 뺀다. 예전 FD 톤 판은 git 이력.
 */
export default async function ContactPage() {
  const isApp = await isAppContextServer()
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '문의하기', path: '/contact' },
  ])
  return (
    <SiteShell>
      <main>
        <JsonLd id="ld-contact-crumbs" data={crumbLd} />
        <section style={{ padding: isApp ? '20px 20px 0' : '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {!isApp && (
            <>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>문의하기</span>
              <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
                궁금한 점이
                <br />
                있다면
              </h1>
            </>
          )}
          <p style={{ margin: isApp ? 0 : '14px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>
            제품·주문·정기배송·반품, 무엇이든 적어 보내 주세요. 영업일에는 24시간 안에, 가능하면 더 빨리 답변드려요.
          </p>
        </section>

        <section aria-label="연락 방법" style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            <Channel href={`mailto:${business.email}`} label="이메일" icon={<MailIcon />}>
              <span style={{ fontSize: 17, fontWeight: 800, wordBreak: 'break-all' }}>{business.email}</span>
            </Channel>
            <Channel href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} label="전화 · 평일 10:00–18:00" icon={<PhoneIcon />}>
              <span className="n" style={{ fontSize: 19 }}>
                {business.phone}
              </span>
            </Channel>
            {business.kakaoChannelUrl && (
              <Channel href={business.kakaoChannelUrl} label="카카오 채널" icon={<KakaoIcon />} kakao external>
                <span style={{ fontSize: 17, fontWeight: 800 }}>1:1 채팅</span>
              </Channel>
            )}
          </div>
        </section>

        <section aria-labelledby="contact-message" style={{ padding: '44px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h2 id="contact-message" className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            메시지 남기기
          </h2>
          <div style={{ marginTop: 18 }}>
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </div>
        </section>

        <section style={{ padding: '32px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <Link
            href="/faq"
            style={{
              minHeight: 72,
              padding: '12px 16px',
              boxSizing: 'border-box',
              borderRadius: 4,
              background: '#F6F4F5',
              display: 'grid',
              gridTemplateColumns: '1fr 18px',
              columnGap: 10,
              alignItems: 'center',
              color: '#141414',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>먼저 자주 묻는 질문도 확인해 보세요</span>
              <span style={{ fontSize: 15, color: '#595959' }}>식단·배송·결제·정기배송 답변이 모여 있어요</span>
            </span>
            <Chevron />
          </Link>
        </section>
      </main>
    </SiteShell>
  )
}

/** 연락 채널 한 줄(시안 C18) — 40px 동그라미 아이콘 · 회색 라벨 위, 굵은 값 아래 · 오른쪽 꺾쇠(바깥 링크는 ↗). */
function Channel({
  href,
  label,
  icon,
  kakao,
  external,
  children,
}: {
  href: string
  label: string
  icon: React.ReactNode
  kakao?: boolean
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        minHeight: 72,
        borderBottom: '1px solid #E5E5E5',
        display: 'grid',
        gridTemplateColumns: '44px 1fr 18px',
        columnGap: 10,
        alignItems: 'center',
        color: '#141414',
        textDecoration: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: kakao ? '#FEE500' : '#F6F4F5',
          color: kakao ? '#191919' : '#141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>{label}</span>
        {children}
      </span>
      {external ? <OutArrow /> : <Chevron />}
    </a>
  )
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.8 5.8L16 13l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6 2 2 0 0 1 6.5 4z" />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20l3.6-2.3c.8.2 1.6.3 2.4.3 5 0 9-3.1 9-7s-4-7-9-7z" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function OutArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}
