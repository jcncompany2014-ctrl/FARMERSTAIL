import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getEventBySlug,
  getAllEventSlugs,
  formatEventDateRange,
  type EventPalette,
} from '@/lib/events/data'
import EventClaimBlock from '@/components/events/EventClaimBlock'
import ShareButton from '@/components/ShareButton'
import JsonLd from '@/components/JsonLd'
import { buildEventJsonLd, SITE_URL } from '@/lib/seo/jsonld'

/**
 * /events/[slug] — 이벤트 상세.
 *
 * 섹션 순서:
 *   1) Hero — palette 배경 풀블리드 블록. kicker · enTitle · koSubtitle ·
 *      tagline · status chip · dateRange.
 *   2) Primary CTA (EventClaimBlock) — 쿠폰 발급 / 웰컴 카운트다운 / 자동
 *      적용 안내. 클라이언트 컴포넌트라 인터랙션 (복사 / 토스트 / 타이머)
 *      을 담당.
 *   3) Perks — "혜택 3가지" 불릿. 에디토리얼 톤.
 *   4) Terms — 유의사항. 작은 글씨 + muted.
 *   5) 보조 CTA — ctaSecondary 있으면 하단 arrow link.
 *
 * 서버 컴포넌트 — 웰컴 이벤트의 경우 유저 created_at 이 필요해 여기서
 * supabase 로 읽어 client 블록에 prop 으로 내려준다. 이렇게 하면 hydration
 * 시 깜빡임 없이 카운트다운이 바로 시작됨.
 */

export async function generateStaticParams() {
  // 빌드 타임에 실행되므로 cookie 기반 server client 사용 불가 (Next 16).
  // service-role admin client 는 HTTP 요청 없이 동작하므로 여기서 OK.
  // force-dynamic 이라 ISR 전환 전까지는 실제 static 결과가 쓰이지 않지만,
  // 다음 단계(개별 이벤트 캐싱)로 넘어갈 때 바로 쓸 수 있도록 유지.
  try {
    const admin = createAdminClient()
    const slugs = await getAllEventSlugs(admin)
    return slugs.map((slug) => ({ slug }))
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY 미설정 환경 (local checkout 등) 은
    // 정적 파라미터 0개로 돌아간다 — force-dynamic 이므로 문제 없음.
    return []
  }
}

// Welcome 이벤트는 user.created_at 이 필요해서 dynamic rendering 필요 —
// 하지만 다른 이벤트는 static 이 가능하므로 page 별로 분기 어려움 → 전체
// dynamic 처리.
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const event = await getEventBySlug(supabase, slug)
  if (!event) return { title: '이벤트를 찾을 수 없어요' }

  // 카카오/페이스북 share card — admin 이 imageUrl 을 설정했으면 그걸, 없으면
  // /api/og 동적 생성으로 브랜드 일관 카드. variant=editorial 톤 (gold accent).
  const ogFallback = `/api/og?variant=editorial&title=${encodeURIComponent(
    event.enTitle,
  )}&subtitle=${encodeURIComponent(event.koSubtitle.slice(0, 100))}&tag=${encodeURIComponent('Event')}`

  const ogImages = event.imageUrl
    ? [
        { url: event.imageUrl, width: 1200, height: 630, alt: event.enTitle },
        { url: ogFallback, width: 1200, height: 630, alt: event.enTitle },
      ]
    : [{ url: ogFallback, width: 1200, height: 630, alt: event.enTitle }]

  return {
    title: `${event.enTitle} · ${event.koSubtitle}`,
    description: event.tagline,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      type: 'website',
      url: `/events/${event.slug}`,
      title: `${event.enTitle} · ${event.koSubtitle} | 파머스테일`,
      description: event.tagline,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${event.enTitle} · ${event.koSubtitle}`,
      description: event.tagline,
      images: ogImages.map((i) => i.url),
    },
  }
}

const PALETTE_MAP: Record<
  EventPalette,
  { bg: string; text: string; accent: string; body: string; rule: string }
> = {
  ink: {
    bg: 'var(--ink)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.82)',
    rule: 'rgba(245,240,230,0.18)',
  },
  terracotta: {
    bg: 'var(--terracotta)',
    text: 'var(--bg)',
    accent: '#F5E0C2',
    body: 'rgba(245,240,230,0.9)',
    rule: 'rgba(245,240,230,0.22)',
  },
  moss: {
    bg: 'var(--moss)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.88)',
    rule: 'rgba(245,240,230,0.22)',
  },
  gold: {
    bg: 'var(--gold)',
    text: 'var(--ink)',
    accent: 'var(--terracotta)',
    body: 'rgba(30,26,20,0.72)',
    rule: 'rgba(30,26,20,0.18)',
  },
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const event = await getEventBySlug(supabase, slug)
  if (!event) notFound()

  // user.created_at — 웰컴 카운트다운 기준. 로그인 안 되어 있으면 null 로
  // 내려서 EventClaimBlock 이 "anonymous" 분기로 렌더되게 한다.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userCreatedAt = user?.created_at ?? null

  const palette = PALETTE_MAP[event.palette]
  const dateRange = formatEventDateRange(event.startsAt, event.endsAt)

  // Event JSON-LD — Google rich result. Schema.org Event 는 본래 물리/가상
  // 이벤트용이지만 organizer / location.VirtualLocation 으로 쇼핑 프로모션을
  // 표현 가능. 이미지 URL 은 절대 경로 변환.
  const eventUrl = `${SITE_URL}/events/${event.slug}`
  const eventImage = event.imageUrl
    ? event.imageUrl.startsWith('http')
      ? event.imageUrl
      : `${SITE_URL}${event.imageUrl}`
    : null
  const eventJsonLd = buildEventJsonLd({
    name: `${event.koSubtitle} · ${event.enTitle}`,
    description: event.tagline ?? event.koSubtitle,
    startDate: event.startsAt,
    endDate: event.endsAt,
    url: eventUrl,
    imageUrl: eventImage,
  })

  return (
    <main className="pb-14 md:pb-20 mx-auto" style={{ background: 'var(--bg)', maxWidth: 880 }}>
      <JsonLd data={eventJsonLd} />
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: palette.bg,
          color: palette.text,
        }}
      >
        {/* 배경 이미지 — 있으면 palette 위에 풀블리드로. 텍스트 가독성을
            위해 palette 색을 opacity 로 덮는 tint 층을 하나 더. gold 는
            light palette 라 덜 덮음. */}
        {event.imageUrl && (
          <>
            <Image
              src={event.imageUrl}
              alt={event.imageAlt ?? event.enTitle}
              fill
              priority
              sizes="(max-width: 880px) 100vw, 880px"
              className="object-cover"
              style={{ zIndex: 0 }}
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: palette.bg,
                opacity: event.palette === 'gold' ? 0.55 : 0.72,
                zIndex: 1,
              }}
            />
          </>
        )}

        {/* 우상단 spotlight */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
            zIndex: 2,
          }}
        />

        <div className="relative px-5 md:px-10 pt-8 md:pt-14 pb-8 md:pb-14" style={{ zIndex: 3 }}>
          {/* 상단 meta row */}
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 text-[9.5px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: palette.rule,
                color: palette.text,
                letterSpacing: '0.08em',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: palette.accent }}
              />
              {event.statusLabel}
            </span>
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: palette.body, letterSpacing: '0.02em' }}
            >
              {dateRange}
            </span>
          </div>

          {/* kicker */}
          <div
            className="mt-7 text-[9.5px] font-semibold uppercase"
            style={{ letterSpacing: '0.2em', color: palette.body }}
          >
            {event.kicker}
          </div>

          {/* enTitle */}
          <h1
            className="font-serif mt-2 md:mt-3 leading-[0.92] text-[44px] md:text-[80px] lg:text-[96px]"
            style={{
              fontWeight: 900,
              color: palette.text,
              letterSpacing: '-0.04em',
            }}
          >
            {event.enTitle}
          </h1>

          {/* koSubtitle */}
          <div
            className="font-serif italic mt-2 md:mt-3 text-[20px] md:text-[32px] lg:text-[40px]"
            style={{
              fontWeight: 500,
              color: palette.accent,
              letterSpacing: '-0.02em',
            }}
          >
            {event.koSubtitle}
          </div>

          {/* tagline */}
          <p
            className="mt-5 md:mt-7 leading-relaxed text-[13px] md:text-[16px] max-w-[560px]"
            style={{
              color: palette.body,
            }}
          >
            {event.tagline}
          </p>

          {/* highlight bar */}
          <div
            className="mt-6 md:mt-10 pt-5 md:pt-7 flex items-baseline justify-between"
            style={{ borderTop: `1px solid ${palette.rule}` }}
          >
            <span
              className="text-[9.5px] md:text-[11px] font-mono uppercase"
              style={{
                letterSpacing: '0.22em',
                color: palette.body,
              }}
            >
              Benefit
            </span>
            <span
              className="font-serif text-[22px] md:text-[34px] lg:text-[42px]"
              style={{
                fontWeight: 900,
                color: palette.accent,
                letterSpacing: '-0.025em',
              }}
            >
              {event.highlight}
            </span>
          </div>
        </div>
      </section>

      {/* ── Lede + Primary CTA ────────────────────────────────
          배경은 palette bg 를 그대로 이어받아 cinematic 한 붉은/짙은 블록
          하나처럼 읽히게 한다. 같은 palette 위에서 CTA 버튼은 onDarkBg=true
          변형으로 대비 유지. */}
      <section
        className="relative"
        style={{
          background: palette.bg,
          color: palette.text,
        }}
      >
        <div
          className="relative px-5 md:px-10 py-8 md:py-12"
          style={{
            borderTop: `1px dashed ${palette.rule}`,
          }}
        >
          <p
            className="font-serif leading-relaxed text-[15px] md:text-[18px] lg:text-[20px] max-w-[640px]"
            style={{
              fontWeight: 500,
              color: palette.text,
              letterSpacing: '-0.01em',
            }}
          >
            {event.detailLede}
          </p>

          <div
            className="mt-7 md:mt-10 pt-7 md:pt-10"
            style={{ borderTop: `1px solid ${palette.rule}` }}
          >
            <EventClaimBlock
              event={event}
              userCreatedAt={userCreatedAt}
              onDarkBg
            />
          </div>

          {/* 공유 버튼 — 이벤트 카피/혜택을 친구에게 빠르게 전달 */}
          <div className="mt-6 md:mt-8">
            <ShareButton
              url={`/events/${event.slug}`}
              title={`${event.enTitle} · ${event.koSubtitle}`}
              description={event.tagline}
              imageUrl={event.imageUrl ?? undefined}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition active:scale-[0.97]"
              style={{
                background: 'rgba(245,240,230,0.12)',
                color: palette.text,
                boxShadow: `inset 0 0 0 1px ${palette.rule}`,
                letterSpacing: '-0.01em',
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Perks ───────────────────────────────────────────── */}
      <section className="px-5 md:px-10 pt-10 md:pt-14">
        <div className="flex items-center gap-2 mb-5 md:mb-7">
          <span className="kicker">Perks · 혜택</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <ul className="flex flex-col gap-3 md:gap-4">
          {event.perks.map((perk, i) => (
            <li
              key={i}
              className="flex gap-3 md:gap-5 items-start pb-3.5 md:pb-5"
              style={{
                borderBottom:
                  i === event.perks.length - 1
                    ? 'none'
                    : '1px solid var(--rule)',
              }}
            >
              <span
                className="font-serif tabular-nums shrink-0 text-[11px] md:text-[14px] mt-[3px] md:mt-[4px]"
                style={{
                  fontWeight: 800,
                  color: 'var(--terracotta)',
                  letterSpacing: '0.05em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <p
                className="leading-relaxed text-[13.5px] md:text-[16px]"
                style={{
                  color: 'var(--ink)',
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                {perk}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Terms ───────────────────────────────────────────── */}
      <section className="px-5 md:px-10 pt-10 md:pt-14">
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <span className="kicker kicker-muted">Terms · 유의사항</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <ul
          className="flex flex-col gap-2 md:gap-2.5 rounded-2xl px-5 py-4 md:px-7 md:py-6"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
          }}
        >
          {event.terms.map((term, i) => (
            <li
              key={i}
              className="flex gap-2 md:gap-2.5 text-[11.5px] md:text-[13px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              <span aria-hidden style={{ color: 'var(--rule)' }}>
                ·
              </span>
              <span>{term}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 하단 back link ──────────────────────────────────── */}
      <section className="px-5 md:px-10 mt-10 md:mt-14">
        <Link
          href="/events"
          className="flex items-center justify-between rounded-2xl px-5 py-4 md:px-7 md:py-6 hover:border-text transition"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
          }}
        >
          <div>
            <span className="kicker">More</span>
            <div
              className="font-serif mt-1 md:mt-1.5 text-[14px] md:text-[18px]"
              style={{
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              다른 이벤트 보기
            </div>
          </div>
          <ArrowRight
            className="w-4 h-4 md:w-5 md:h-5"
            style={{ color: 'var(--ink)' }}
            strokeWidth={2.5}
          />
        </Link>
      </section>
    </main>
  )
}
