import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronRight,
  Mail,
  Sparkles,
  Calendar,
  BookOpen,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react'
import NewsletterForm from './NewsletterForm'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import { Eyebrow, PhotoSlot } from '@/components/web/fd/ui'

type SearchParamsT = Promise<{ status?: string }>

const STATUS_MESSAGES: Record<
  string,
  { tone: 'success' | 'error' | 'info'; title: string; body: string }
> = {
  confirmed: {
    tone: 'success',
    title: '구독 확인 완료!',
    body: '이메일 인증이 완료되었어요. 다음 첫째 주에 첫 뉴스레터로 만나요.',
  },
  already: {
    tone: 'info',
    title: '이미 구독 중이에요',
    body: '이메일 인증이 이미 완료된 주소예요.',
  },
  unsubscribed: {
    tone: 'success',
    title: '구독을 해지했어요',
    body: '앞으로 뉴스레터를 보내지 않아요. 언제든 다시 구독해 주세요.',
  },
  'already-unsubscribed': {
    tone: 'info',
    title: '이미 해지된 상태예요',
    body: '재구독을 원하시면 아래 폼에서 다시 신청해 주세요.',
  },
  invalid: {
    tone: 'error',
    title: '링크가 만료되었어요',
    body: '확인 링크가 잘못되었거나 만료되었어요. 새 신청 메일을 받아주세요.',
  },
  error: {
    tone: 'error',
    title: '지금 처리하지 못했어요',
    body: '잠시 후 다시 시도해 주세요. 계속되면 story@farmerstail.kr 로 연락해 주세요.',
  },
}

/**
 * /newsletter — 뉴스레터 구독 페이지 (FD 재구축, 2026-06-14 회차33).
 *
 * FD 톤 마케팅 페이지: 2단 히어로(텍스트 + PhotoSlot) → 혜택 3카드 → 파인
 * 구독 카드(NewsletterForm 클라이언트 아일랜드). 폼 submit 시 Supabase
 * consent_log + profiles 저장 — 폼 로직은 NewsletterForm 에 보존. layout 의
 * AuthAwareShell 이 chrome dispatch (웹/앱 공유 — /account·푸터 양쪽 링크).
 */

// R99-A (D7): openGraph images 누락 → 공유 카드 썸네일 0 (shallow merge).
const NEWSLETTER_OG = ogImageUrl({
  title: '파머스테일 뉴스레터',
  subtitle: '월 1회, 농장 + 신상 + 케어 가이드',
  tag: 'Newsletter',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차149).
  title: '뉴스레터 구독',
  description:
    '월 1회, 농장 소식 + 신상 메뉴 + 케어 가이드를 정리해서 보내드려요. 광고는 줄이고 인사이트만.',
  alternates: { canonical: '/newsletter' },
  openGraph: {
    title: '파머스테일 뉴스레터 — 월 1회',
    description: '월 1회, 농장 + 신상 + 케어 가이드.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/newsletter',
    images: [
      { url: NEWSLETTER_OG, width: 1200, height: 630, alt: '파머스테일 뉴스레터' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '파머스테일 뉴스레터 — 월 1회',
    description: '월 1회, 농장 + 신상 + 케어 가이드.',
    images: [NEWSLETTER_OG],
  },
  robots: { index: true, follow: true },
}

const PERKS = [
  {
    icon: Calendar,
    title: '월 1회',
    body: '받은편지함을 더럽히지 않아요. 월 1회 첫째 주.',
  },
  {
    icon: Sparkles,
    title: '신상 먼저',
    body: '시즌 한정 / 새 메뉴 출시는 항상 구독자에게 24시간 먼저.',
  },
  {
    icon: BookOpen,
    title: '케어 인사이트',
    body: '반려 영양 칼럼 · 농장 다큐 · 사용자 후기 큐레이션.',
  },
]

// status banner 색 — FD 토큰 기반(success=green, error=coral, info=cream).
const BANNER_TONE = {
  success: {
    bg: 'color-mix(in srgb, var(--fd-green) 12%, var(--fd-offwhite))',
    icon: 'var(--fd-green)',
  },
  error: {
    bg: 'color-mix(in srgb, var(--fd-coral) 12%, var(--fd-offwhite))',
    icon: 'var(--fd-coral)',
  },
  info: { bg: 'var(--fd-cream)', icon: 'var(--fd-muted)' },
} as const

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const { status } = await searchParams
  const banner = status ? STATUS_MESSAGES[status] : null

  // 시각 breadcrumb(아래 nav)에 더해 검색엔진용 BreadcrumbList 구조화데이터(회차123).
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '뉴스레터', path: '/newsletter' },
  ])

  return (
    <main
      className="pb-14 md:pb-24 mx-auto px-5 md:px-8"
      style={{ background: 'var(--fd-offwhite)', maxWidth: 1080 }}
    >
      <JsonLd id="ld-newsletter-crumbs" data={crumbLd} />
      {/* breadcrumb */}
      <nav
        aria-label="현재 위치"
        className="flex items-center gap-1 text-[11px] md:text-[12px] pt-4 md:pt-6"
        style={{ color: 'var(--fd-muted)' }}
      >
        <Link href="/" className="hover:opacity-70 transition">
          홈
        </Link>
        <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
        <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>뉴스레터</span>
      </nav>

      {/* status banner */}
      {banner && (
        <div
          className="mt-4 rounded-lg px-4 py-3 md:px-5 md:py-4 flex items-start gap-3"
          style={{
            background: BANNER_TONE[banner.tone].bg,
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
          }}
        >
          {banner.tone === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} color={BANNER_TONE.success.icon} />
          ) : banner.tone === 'error' ? (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} color={BANNER_TONE.error.icon} />
          ) : (
            <Info className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} color={BANNER_TONE.info.icon} />
          )}
          <div>
            <p className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}>
              {banner.title}
            </p>
            <p className="mt-1 text-[12px] md:text-[13.5px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
              {banner.body}
            </p>
          </div>
        </div>
      )}

      {/* Hero — 2단(텍스트 + PhotoSlot) */}
      <section className="grid md:grid-cols-2 md:items-center gap-8 md:gap-12 pt-7 md:pt-14 pb-10 md:pb-16">
        <div>
          <Eyebrow>Newsletter · 뉴스레터</Eyebrow>
          <h1
            className="mt-3 md:mt-4 text-[30px] md:text-[46px] lg:text-[52px]"
            style={{ fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.035em', lineHeight: 1.05 }}
          >
            농장에서 꼬리까지,
            <br />
            <span style={{ color: 'var(--fd-coral)' }}>월 1회 정리해서</span>
          </h1>
          <p
            className="mt-4 md:mt-5 text-[14px] md:text-[16px] leading-relaxed"
            style={{ color: 'var(--fd-muted)', maxWidth: 460 }}
          >
            광고는 줄이고 인사이트만. 농장 다큐, 신상 메뉴, 케어 가이드를 한 편으로
            묶어 매월 첫째 주에 보내드려요.
          </p>
        </div>
        <PhotoSlot
          src="/farm-landscape.jpg"
          alt="신선한 재료를 기르는 농장 풍경"
          label="뉴스레터 / 농장 풍경 사진"
          sub="브랜드 이미지 자리"
          ratio="4 / 3"
          tone="cream"
          rounded={12}
          className="w-full"
        />
      </section>

      {/* 혜택 3카드 */}
      <section className="pb-10 md:pb-16">
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {PERKS.map((p) => {
            const Icon = p.icon
            return (
              <li
                key={p.title}
                className="rounded-lg p-5 md:p-6"
                style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)' }}
              >
                <span
                  className="inline-flex w-10 h-10 md:w-11 md:h-11 rounded-full items-center justify-center mb-3 md:mb-4"
                  style={{ background: 'var(--fd-offwhite)' }}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2} color="var(--fd-coral)" />
                </span>
                <h2
                  className="text-[16px] md:text-[18px]"
                  style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
                >
                  {p.title}
                </h2>
                <p className="mt-1.5 md:mt-2 text-[13px] md:text-[13.5px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
                  {p.body}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 구독 카드 — 파인 */}
      <section>
        <div
          className="rounded-[12px] p-6 md:p-10"
          style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Mail className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} color="var(--fd-green-soft)" />
            <Eyebrow color="var(--fd-green-soft)">Subscribe</Eyebrow>
          </div>
          <h2
            className="text-[20px] md:text-[28px]"
            style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
          >
            받은편지함에서 만나요
          </h2>
          <p
            className="mt-2 md:mt-3 text-[13px] md:text-[14.5px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            언제든 구독 해지 가능. 이메일은 뉴스레터 발송에만 쓰고 외부에 공유하지
            않아요.
          </p>

          <NewsletterForm />
        </div>
      </section>
    </main>
  )
}
