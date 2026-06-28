import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, MapPin, Sprout, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import WebChrome from '@/components/WebChrome'
import StickyCta from '@/components/web/fd/StickyCta'

/**
 * /partners — 농장 파트너 소개 페이지.
 *
 * 우선 DB (`partners` 테이블, /admin/partners 에서 관리) 에서 published 행을
 * 가져오고, 비어 있거나 fetch 가 실패하면 hardcoded fallback (FALLBACK_PARTNERS)
 * 을 그대로 보여줘서 페이지가 절대 빈 채로 노출되지 않도록 한다.
 */
export const revalidate = 300

// R99-A (D7): openGraph images 누락 → 공유 카드 썸네일 0 (shallow merge).
const PARTNERS_OG = ogImageUrl({
  title: '농장 파트너',
  subtitle: '재료의 출처를 농가 단위까지',
  tag: 'Partners',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차149).
  title: '농장 파트너',
  description:
    '재료의 출처를 농가 단위까지 밝히는 것을 원칙으로 삼습니다. 그 원칙에 맞는 농가를 한 곳씩 찾아가고 있어요.',
  alternates: { canonical: '/partners' },
  openGraph: {
    title: '농장 파트너 | 파머스테일',
    description:
      '재료의 출처를 농가 단위까지 추적합니다. 익명의 “수입산”은 들어가지 않아요.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/partners',
    images: [{ url: PARTNERS_OG, width: 1200, height: 630, alt: '농장 파트너' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '농장 파트너 | 파머스테일',
    description:
      '재료의 출처를 농가 단위까지 추적합니다. 익명의 “수입산”은 들어가지 않아요.',
    images: [PARTNERS_OG],
  },
  robots: { index: true, follow: true },
}

type Partner = {
  region: string
  name: string
  ingredient: string
  body: string
  cert?: string | null
  image_url?: string | null
}

// 아직 공개할 수 있는 실제 계약 농가가 없으므로 fallback 은 비워 둔다.
// DB(partners 테이블, /admin/partners)에 실제 계약 농가가 등록되면 그 데이터가
// 카드로 표시되고, 비어 있는 동안에는 "함께할 농가를 찾습니다" 비전 섹션이 노출된다.
// (실 계약·인증 확보 시 위 형태로 데이터만 채우면 자동 복원 — 회차 정리 2026-06)
const FALLBACK_PARTNERS: Partner[] = []

function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/start'
}

export default async function PartnersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user
  let partners: Partner[] = []
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('region, name, ingredient, body, cert, image_url')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) {
      partners = data as Partner[]
    }
  } catch {
    // table missing — fallback below
  }
  if (partners.length === 0) partners = FALLBACK_PARTNERS

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '농장 파트너', path: '/partners' },
  ])

  return (
    <WebChrome>
    <JsonLd id="ld-partners-crumbs" data={crumbLd} />
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--fd-offwhite)', maxWidth: 1280 }}
    >
      {/* breadcrumb */}
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--fd-muted)' }}
        >
          <Link href="/" className="hover:opacity-70 transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <Link href="/brand" className="hover:opacity-70 transition">
            브랜드
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--fd-pine)', fontWeight: 700 }}>
            농장 파트너
          </span>
        </nav>
      </div>

      <section className="px-5 md:px-12 pt-6 md:pt-14 pb-8 md:pb-12">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--fd-coral-text)' }}
        >
          Partners · 농장 파트너
        </span>
        <h1
          className="font-chunky mt-3 md:mt-5 text-[28px] md:text-[52px] lg:text-[64px]"
          style={{
            fontWeight: 800,
            color: 'var(--fd-pine)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          재료에는
          <br />
          <span style={{ color: 'var(--fd-coral-text)' }}>이름이 있어야 해요</span>
        </h1>
        <p
          className="mt-4 md:mt-6 text-[13px] md:text-[16.5px] leading-relaxed max-w-xl"
          style={{ color: 'var(--fd-muted)' }}
        >
          우리는 재료의 원산지를 농가 단위까지 밝히는 것을 원칙으로 삼습니다.
          익명의 ‘수입산 육류’나 ‘복합 곡물’에 기대지 않고, 출처가 분명한
          원료를 한 곳씩 찾아가고 있어요.
        </p>
      </section>

      {partners.length > 0 ? (
      <section className="px-5 md:px-12 pb-12">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {partners.map((p) => (
            <li
              key={p.name}
              className="rounded-[12px] overflow-hidden"
              style={{
                background: 'var(--fd-cream)',
                boxShadow: 'inset 0 0 0 1px var(--fd-line)',
              }}
            >
              {p.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-44 md:h-56 object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-5 md:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1.5 mb-2 md:mb-3">
                      <MapPin
                        className="w-3.5 h-3.5"
                        strokeWidth={2}
                        color="var(--fd-coral-text)"
                      />
                      <span
                        className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
                        style={{ color: 'var(--fd-coral-text)', fontWeight: 700 }}
                      >
                        {p.region}
                      </span>
                    </div>
                    <h2
                      className="font-bold text-[18px] md:text-[22px]"
                      style={{
                        fontWeight: 800,
                        color: 'var(--fd-pine)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                      }}
                    >
                      {p.name}
                    </h2>
                    <div
                      className="mt-1 md:mt-1.5 text-[12px] md:text-[13.5px]"
                      style={{ color: 'var(--fd-muted)' }}
                    >
                      {p.ingredient}
                    </div>
                  </div>
                  {p.cert && (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] md:text-[10.5px] font-bold"
                      style={{
                        background: 'color-mix(in srgb, var(--fd-green) 12%, var(--fd-offwhite))',
                        color: 'var(--fd-green)',
                      }}
                    >
                      <Award className="w-3 h-3" strokeWidth={2.25} />
                      {p.cert}
                    </span>
                  )}
                </div>

                <p
                  className="mt-3 md:mt-5 text-[13px] md:text-[15px] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  {p.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      ) : (
      <section className="px-5 md:px-12 pb-12">
        <div
          className="rounded-[12px] px-5 py-8 md:px-10 md:py-12"
          style={{
            background: 'var(--fd-cream)',
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
          }}
        >
          <h2
            className="font-chunky text-[19px] md:text-[26px]"
            style={{
              fontWeight: 800,
              color: 'var(--fd-pine)',
              letterSpacing: '-0.02em',
            }}
          >
            이런 농가와 함께하고 싶어요
          </h2>
          <p
            className="mt-2 md:mt-3 text-[13px] md:text-[15px] leading-relaxed max-w-xl"
            style={{ color: 'var(--fd-muted)' }}
          >
            아직 공개할 수 있는 계약 농가는 없습니다. 대신, 우리가 함께할
            농가를 고를 때 지키려는 기준을 먼저 약속드려요. 이 기준에 맞는
            곳들을 한 곳씩 찾아가고 있어요.
          </p>
          <ul className="mt-5 md:mt-7 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {[
              {
                t: '출처가 분명한 곳',
                b: '원산지를 농가 단위까지 밝힐 수 있는 곳. 익명의 “수입산”에 기대지 않아요.',
              },
              {
                t: '정직하게 기르는 곳',
                b: '사육·재배 과정을 투명하게 보여줄 수 있는 곳. 숨길 게 없는 원료만.',
              },
              {
                t: '신선하게 닿는 곳',
                b: '수확·도축에서 조리까지 짧게. 가까운 곳에서, 빠르게.',
              },
            ].map((c) => (
              <li
                key={c.t}
                className="rounded-[10px] p-4 md:p-5"
                style={{ background: 'var(--fd-offwhite)' }}
              >
                <div className="inline-flex items-center gap-1.5 mb-2">
                  <Sprout
                    className="w-4 h-4"
                    strokeWidth={2}
                    color="var(--fd-coral-text)"
                  />
                  <span
                    className="font-bold text-[14px] md:text-[16px]"
                    style={{ color: 'var(--fd-pine)' }}
                  >
                    {c.t}
                  </span>
                </div>
                <p
                  className="text-[12.5px] md:text-[13.5px] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  {c.b}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      <section className="px-5 md:px-12">
        <div
          className="rounded-[12px] px-5 py-6 md:px-10 md:py-10 text-center"
          style={{ background: 'var(--fd-pine)', color: 'var(--fd-offwhite)' }}
        >
          <Sprout
            className="w-7 h-7 md:w-9 md:h-9 mx-auto"
            strokeWidth={1.6}
            color="var(--fd-coral)"
          />
          <h2
            className="font-chunky mt-3 md:mt-4 text-[19px] md:text-[28px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            농장과 함께 키우는 식탁
          </h2>
          <p
            className="mt-2 md:mt-4 text-[12.5px] md:text-[15px] leading-relaxed mx-auto max-w-xl"
            style={{ color: 'rgba(245,240,230,0.78)' }}
          >
            함께할 농가를 늘 찾고 있어요. 함께 작업하고 싶은 농가는
            아래 메일로 제안해 주세요.
          </p>
          <a
            href="mailto:b2b@farmerstail.kr?subject=농가 파트너 제안"
            className="inline-flex items-center gap-1.5 mt-5 md:mt-7 px-5 md:px-7 py-2.5 md:py-3 rounded-full text-[12.5px] md:text-[14px] font-bold"
            style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
          >
            농가 제안 보내기
          </a>
        </div>
      </section>
    </main>
      <StickyCta href={planHref(isAuthed)} />
    </WebChrome>
  )
}
