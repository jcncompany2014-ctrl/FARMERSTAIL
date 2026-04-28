import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import HeroSlideshow from '@/components/landing/HeroSlideshow'
import CornerTicks from '@/components/landing/CornerTicks'
import OngoingEvents from '@/components/landing/OngoingEvents'
import ProductRail, { type RailProduct } from '@/components/landing/ProductRail'
import { getActiveEvents } from '@/lib/events/data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "파머스테일 — 농장에서 꼬리까지",
  description:
    '수의영양학 기반의 프리미엄 반려견 식단. 사람이 먹는 등급의 재료로, 농장에서 꼬리까지. Farm to Tail.',
  alternates: { canonical: '/' },
  openGraph: {
    title: "파머스테일 — 농장에서 꼬리까지",
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 사람이 먹는 등급의 재료로, 농장에서 꼬리까지.',
    url: '/',
  },
}

type SupabaseProduct = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
}

// Ordered tints for product cards; cycles if more products than tints.
const PRODUCT_TINTS = [
  '#E4DBC2',
  '#C9D5B0',
  '#E8C9B2',
  '#D9CFBB',
  '#EFD9A8',
]

// Design-spec fallback products — shown when Supabase has no live catalog yet.
// Keeps the landing visually complete for unauthenticated visitors.
const FALLBACK_RAIL: RailProduct[] = [
  {
    id: 'fallback-1',
    href: '/products',
    cat: 'VEGGIE · 채소 믹스',
    enName: 'HARVEST VEGGIE MIX',
    koName: '채소 믹스',
    body: '제철 국내산 채소를 동결건조한 식이섬유 풍부 토핑.',
    price: 14900,
    weight: '80g',
    tint: '#E4DBC2',
    imageUrl: null,
  },
  {
    id: 'fallback-2',
    href: '/products',
    cat: 'OMEGA · 해산물',
    enName: 'OCEAN OMEGA MIX',
    koName: '오메가 믹스',
    body: '연어·대구 기반 오메가-3 풍부한 해산물 토퍼.',
    price: 16900,
    weight: '80g',
    tint: '#C9D5B0',
    imageUrl: null,
  },
  {
    id: 'fallback-3',
    href: '/products',
    cat: 'PROTEIN · 단백질',
    enName: 'HIGHLAND BEEF CHIP',
    koName: '한우 단백 칩',
    body: '강원 한우 안심만 저온 동결건조한 고단백 스낵.',
    price: 18900,
    weight: '60g',
    tint: '#E8C9B2',
    imageUrl: null,
  },
  {
    id: 'fallback-4',
    href: '/products',
    cat: 'SUPPORT · 관절',
    enName: 'JOINT BONE BROTH',
    koName: '관절 본브로스',
    body: '24시간 끓인 사골 본브로스를 분말로. 관절 보조 토퍼.',
    price: 19900,
    weight: '100g',
    tint: '#D9CFBB',
    imageUrl: null,
    tag: 'NEW',
  },
  {
    id: 'fallback-5',
    href: '/products',
    cat: 'DIGEST · 소화',
    enName: 'PUMPKIN BELLY MIX',
    koName: '단호박 소화 믹스',
    body: '단호박·귀리·프로바이오틱. 민감한 장을 위한 토핑.',
    price: 13900,
    weight: '80g',
    tint: '#EFD9A8',
    imageUrl: null,
  },
]

// Transform Supabase rows into rail products, assigning tints by order.
function toRailProduct(p: SupabaseProduct, i: number): RailProduct {
  const categoryLabel = (p.category ?? 'PANTRY').toUpperCase()
  const cat = `${categoryLabel.split(' ')[0]} · ${p.category ?? '파머스테일'}`
  const price = p.sale_price ?? p.price
  return {
    id: p.id,
    href: `/products/${p.slug}`,
    cat,
    enName: (p.name ?? '').toUpperCase(),
    koName: p.name,
    body: p.short_description ?? '수의영양학 기반의 프리미엄 라인.',
    price,
    weight: '—',
    tint: PRODUCT_TINTS[i % PRODUCT_TINTS.length],
    imageUrl: p.image_url,
    tag: p.sale_price ? 'SALE' : undefined,
  }
}

// ---------------------------------------------------------------------------
// Small presentational atoms — server-safe
// ---------------------------------------------------------------------------

function Kicker({
  children,
  tone = 'terracotta',
}: {
  children: React.ReactNode
  tone?: 'terracotta' | 'ink' | 'cream' | 'moss'
}) {
  const cls =
    tone === 'ink'
      ? 'kicker kicker-ink'
      : tone === 'cream'
        ? 'kicker kicker-cream'
        : 'kicker'
  const style =
    tone === 'moss' ? { color: 'var(--moss)' } : undefined
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  )
}

function SerialNo({ n, label }: { n: string; label?: string }) {
  // 한 폰트 가족(serif)만 씀. "No."는 기울기로, 번호는 볼드로.
  // alignItems: baseline 이 핵심 — "No." 와 번호가 하나의 베이스라인에 얹혀야
  // 에디토리얼 각인처럼 보인다.
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span
        className="font-serif"
        style={{
          fontSize: 17,
          lineHeight: 1,
          color: 'var(--terracotta)',
          fontWeight: 500,
          fontStyle: 'italic',
        }}
      >
        No.
      </span>
      <span
        className="font-serif tnum"
        style={{
          fontSize: 22,
          lineHeight: 1,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'lining-nums tabular-nums',
        }}
      >
        {n}
      </span>
      {label && (
        <>
          <span
            style={{
              color: 'var(--rule-2)',
              fontSize: 14,
              lineHeight: 1,
              marginLeft: 2,
            }}
          >
            —
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        </>
      )}
    </div>
  )
}

function Placeholder({
  label,
  aspect,
  variant = 'light',
  children,
}: {
  label: string
  aspect: string
  variant?: 'light' | 'dark'
  children?: React.ReactNode
}) {
  return (
    <div
      className={`ph grain grain-soft ${variant === 'dark' ? 'ph-ink' : ''}`}
      style={{ aspectRatio: aspect, width: '100%' }}
    >
      {children}
      <div className="ph-label">{label}</div>
    </div>
  )
}

function OrnamentRule() {
  return (
    <div
      style={{
        margin: '48px 20px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--rule-2)' }} />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="2" fill="var(--terracotta)" />
        <circle cx="9" cy="9" r="6" stroke="var(--terracotta)" strokeWidth="0.8" />
      </svg>
      <div style={{ flex: 1, height: 1, background: 'var(--rule-2)' }} />
    </div>
  )
}

function ArrowGlyph({ width = 16, height = 10 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 16 10" fill="none" aria-hidden="true">
      <path
        d="M1 5h14m-5-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------


function Hero() {
  return (
    <section
      className="grain grain-soft fiber"
      style={{ position: 'relative', background: 'var(--bg)' }}
    >
      {/* Magazine meta strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 20px 6px',
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        <span>Vol. 03 · Spring</span>
        <span className="tnum">2026</span>
      </div>

      {/* Kicker */}
      <div style={{ padding: '6px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 20,
              height: 1,
              background: 'var(--terracotta)',
            }}
          />
          <Kicker>Farm to Tail</Kicker>
        </div>
      </div>

      {/* Headline — 데스크톱에선 큰 magazine 헤드라인 톤 */}
      <h1
        className="font-serif text-[28px] md:text-[64px] lg:text-[80px]"
        style={{
          margin: '6px 20px 0',
          lineHeight: 1.02,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.035em',
        }}
      >
        농장
        <span style={{ color: 'var(--terracotta)' }}>에서</span>
        <br />
        꼬리
        <span
          className="font-serif text-[26px] md:text-[58px] lg:text-[72px]"
          style={{
            fontWeight: 500,
            color: 'var(--terracotta)',
          }}
        >
          까지
        </span>
        .
      </h1>

      <p
        className="text-[12.5px] md:text-[16px] lg:text-[18px]"
        style={{
          margin: '10px 20px 0',
          maxWidth: 600,
          lineHeight: 1.6,
          color: 'var(--text)',
          fontWeight: 400,
        }}
      >
        수의영양학으로 설계하고, 농장에서 바로 손질한 사람이 먹는 등급의 식재료.
      </p>

      {/* Swipeable slideshow — 농장 → 꼬리 → 그릇 */}
      <HeroSlideshow />

      {/* CTAs — 모바일은 세로 stack, 데스크톱은 가로 정렬 + 큰 버튼 */}
      <div className="px-5 md:px-6 pt-3.5 md:pt-6 pb-4 md:pb-8 flex flex-col md:flex-row gap-2 md:gap-3 md:max-w-xl">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2.5 h-[52px] md:h-[60px] px-5 md:px-7 rounded-xl font-semibold text-[15px] md:text-[16.5px] no-underline w-full md:flex-1"
          style={{
            border: '1px solid transparent',
            background: 'var(--terracotta)',
            color: 'var(--bg)',
          }}
        >
          무료로 시작하기
          <ArrowGlyph />
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2.5 h-[52px] md:h-[60px] px-5 md:px-7 rounded-xl font-semibold text-[15px] md:text-[16.5px] no-underline w-full md:flex-1"
          style={{
            background: 'transparent',
            color: 'var(--ink)',
            border: '1px solid var(--ink)',
          }}
        >
          제품 둘러보기
        </Link>
      </div>

      {/* Magazine credit line */}
      <div
        className="font-mono"
        style={{
          padding: '10px 20px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <span>Photography · TBD</span>
        <span>Styling · TBD</span>
      </div>
    </section>
  )
}

function ThreePromises() {
  const items = [
    {
      n: '01',
      en: 'Premium',
      ko: '프리미엄',
      body:
        '사람이 먹는 등급의 재료만. 방목 사육 단백질, 유기농 채소, 무항생제.',
    },
    {
      n: '02',
      en: 'Science',
      ko: '수의영양학',
      body:
        '서울대 수의영양학 자문. AAFCO 기준 이상의 단일 배합 레시피.',
    },
    {
      n: '03',
      en: 'Personal',
      ko: '맞춤 분석',
      body:
        '체중·연령·활동량으로 1:1 설계. 매달 수의사가 리뷰하는 식단 노트.',
    },
  ]
  return (
    <section
      id="promises"
      className="grain grain-soft"
      style={{
        position: 'relative',
        background: 'var(--bg)',
        padding: '56px 0 64px',
      }}
    >
      <div className="px-5 md:px-12">
        <div className="flex justify-between items-center">
          <Kicker>Our Promise</Kicker>
          <span
            className="font-mono text-[9px] md:text-[10.5px]"
            style={{
              letterSpacing: '0.14em',
              color: 'var(--muted)',
            }}
          >
            pp. 012 — 014
          </span>
        </div>
        <h2
          className="font-serif text-[24px] md:text-[48px] lg:text-[56px] mt-4 md:mt-6"
          style={{
            lineHeight: 1.1,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
          }}
        >
          세 가지는 절대
          <br />
          <span
            className="font-serif text-[22px] md:text-[42px] lg:text-[52px]"
            style={{
              fontWeight: 500,
              color: 'var(--terracotta)',
            }}
          >
            타협하지
          </span>{' '}
          않아요.
        </h2>
      </div>

      <div className="mt-10 md:mt-14 px-5 md:px-12">
        {/* 01 — oversized */}
        <div className="mb-9 md:mb-14">
          <SerialNo n={items[0].n} label={items[0].en} />
          <div className="mt-3.5 md:mt-5">
            <Placeholder label="01 · 4:3 · Ingredient macro" aspect="4 / 3">
              <CornerTicks />
            </Placeholder>
          </div>
          <h3
            className="font-serif mt-4 md:mt-6 mb-2 md:mb-3 text-[20px] md:text-[30px] lg:text-[34px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {items[0].ko}
          </h3>
          <p
            className="text-[13.5px] md:text-[16px]"
            style={{
              margin: 0,
              lineHeight: 1.7,
              color: 'var(--text)',
              maxWidth: 720,
            }}
          >
            {items[0].body}
          </p>
        </div>

        {/* 02 + 03 — asymmetric side-by-side */}
        <div className="grid grid-cols-2 gap-3.5 md:gap-8">
          {[items[1], items[2]].map((it) => (
            <div key={it.n}>
              <SerialNo n={it.n} label={it.en} />
              <div className="mt-3 md:mt-4">
                <Placeholder label={`${it.n} · 1:1`} aspect="1 / 1">
                  <CornerTicks />
                </Placeholder>
              </div>
              <h3
                className="font-serif mt-3.5 md:mt-5 mb-1.5 md:mb-2.5 text-[17px] md:text-[24px] lg:text-[28px]"
                style={{
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {it.ko}
              </h3>
              <p
                className="text-[12px] md:text-[15px]"
                style={{
                  margin: 0,
                  lineHeight: 1.65,
                  color: 'var(--text)',
                }}
              >
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <OrnamentRule />
    </section>
  )
}

function ProductsSection({ items }: { items: RailProduct[] }) {
  return (
    <section
      id="products"
      className="grain grain-soft"
      style={{
        position: 'relative',
        background: 'var(--bg)',
        padding: '64px 0 56px',
      }}
    >
      <div className="px-5 md:px-12 mb-6 md:mb-10">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Kicker>Pantry &amp; Toppers</Kicker>
          <Link
            href="/products"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--ink)',
              paddingBottom: 2,
            }}
          >
            전체 보기 →
          </Link>
        </div>
        <h2
          className="font-serif text-[22px] md:text-[44px] lg:text-[56px]"
          style={{
            margin: '14px 0 0',
            lineHeight: 1.05,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.035em',
          }}
        >
          PANTRY MIX &amp;
          <br />
          <span style={{ color: 'var(--terracotta)' }}>GOURMET TOPPERS</span>
        </h2>
        <p
          className="text-[13px] md:text-[16px]"
          style={{
            margin: '14px 0 0',
            lineHeight: 1.6,
            color: 'var(--text)',
            maxWidth: 540,
          }}
        >
          화식의 철학을 일상으로 확장하는 동결건조 라인과 프리미엄 토퍼 시리즈입니다.
        </p>
      </div>

      <ProductRail items={items} />
    </section>
  )
}

function Journey() {
  const steps = [
    {
      n: '01',
      ko: '재료',
      en: 'Ingredients',
      body:
        '강원·전북 계약 농장에서 주 2회 수확. 도축 24시간 내 입고.',
      tag: '경기 이천 · 강원 평창',
    },
    {
      n: '02',
      ko: '레시피',
      en: 'Recipe',
      body:
        '수의영양사가 설계. 저온 스팀 조리로 영양 손실 최소화.',
      tag: '저온 스팀 · 72°C',
    },
    {
      n: '03',
      ko: '배송',
      en: 'Delivery',
      body:
        '조리 후 급속 냉동. 드라이아이스 포장으로 48시간 내 도착.',
      tag: '콜드체인 · 48h',
    },
    {
      n: '04',
      ko: '그릇',
      en: 'Bowl',
      body:
        '해동 후 바로 급여. 체중에 맞춘 1회분 소분 팩으로 남김없이.',
      tag: '1회 · 소분팩',
    },
  ]
  return (
    <section
      id="journey"
      className="grain grain-soft"
      style={{ position: 'relative', background: 'var(--bg-2)' }}
    >
      <div style={{ padding: '64px 20px 24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Kicker>The Journey</Kicker>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--muted)',
            }}
          >
            4 steps · 48h
          </span>
        </div>
        <h2
          className="font-serif text-[24px] md:text-[44px] lg:text-[52px]"
          style={{
            margin: '16px 0 0',
            lineHeight: 1.1,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
          }}
        >
          재료부터 그릇까지,
          <br />
          <span
            className="font-serif text-[22px] md:text-[40px] lg:text-[48px]"
            style={{
              fontWeight: 500,
              color: 'var(--terracotta)',
            }}
          >
            중간
          </span>
          은 없습니다.
        </h2>
      </div>

      {/* Vertical timeline — spine + numbered nodes */}
      <div style={{ position: 'relative', padding: '12px 20px 72px' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 34,
            top: 0,
            bottom: 24,
            width: 1,
            background: 'var(--rule-2)',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 34,
            bottom: 0,
            height: 24,
            borderLeft: '1px dashed var(--rule-2)',
          }}
        />

        {steps.map((s, i) => (
          <div
            key={s.n}
            style={{
              position: 'relative',
              paddingLeft: 60,
              paddingTop: i === 0 ? 8 : 28,
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 22,
                // 원이 1px 커졌으므로 좌표 보정해 축 유지
                top: (i === 0 ? 8 : 28) - 1,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--bg)',
                border: '1px solid var(--ink)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--ink)',
                fontFamily: 'var(--font-display)',
                // display serif의 lining figures를 타바라스트로 고정해
                // "1"이 가늘고 "2"가 넓어지는 폭 차이 제거.
                fontVariantNumeric: 'lining-nums tabular-nums',
                // lineHeight:1 로 line-box를 em-box로 압축해야
                // grid placeItems: center 가 시각적으로도 중앙에 온다.
                lineHeight: 1,
                // serif lining figures 는 em-box 중심보다 살짝 아래에 앉아
                // 광학적으로 0.5px 위로 당겨주면 더 정확히 중앙에 보인다.
                paddingBottom: 1,
              }}
            >
              {i + 1}
            </div>

            <div className="mb-2.5 md:mb-3.5">
              <div className="flex items-baseline gap-2 mb-1">
                <h3
                  className="font-serif text-[22px] md:text-[34px] lg:text-[40px]"
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {s.ko}
                </h3>
                <span
                  className="font-serif text-[13px] md:text-[16px]"
                  style={{ color: 'var(--muted)' }}
                >
                  — {s.en}
                </span>
              </div>
              <div
                className="font-mono text-[9px] md:text-[11px] mb-3 md:mb-4"
                style={{
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--terracotta)',
                }}
              >
                {s.tag}
              </div>
            </div>

            <Placeholder label={`${s.n} · ${s.en} · 16:9`} aspect="16 / 9">
              <CornerTicks />
            </Placeholder>

            <p
              className="text-[13px] md:text-[15.5px]"
              style={{
                margin: '14px 0 0',
                lineHeight: 1.65,
                color: 'var(--text)',
                maxWidth: 520,
              }}
            >
              {s.body}
            </p>
          </div>
        ))}

        <div
          className="font-mono"
          style={{
            marginTop: 28,
            marginLeft: 60,
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          — 꼬리에 닿을 때까지
        </div>
      </div>
    </section>
  )
}

function CertMark({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--rule-2)',
        padding: '12px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid var(--ink)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1px dashed var(--ink)',
          }}
        />
      </div>
      <div>
        <div
          className="font-serif"
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--ink)',
          }}
        >
          {label}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}

function SocialProof() {
  const press = ['MONOCLE', 'W KOREA', 'DAZED', 'NOBLESSE']
  return (
    <section
      className="grain grain-soft"
      style={{ position: 'relative', background: 'var(--bg-2)' }}
    >
      <div style={{ padding: '64px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Kicker>Trusted By</Kicker>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--muted)',
            }}
          >
            Since 2024
          </span>
        </div>
      </div>

      {/* Vet quote */}
      <div
        style={{
          padding: '0 20px',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ width: 72, flexShrink: 0 }}>
          <Placeholder label="VET" aspect="3 / 4">
            <CornerTicks />
          </Placeholder>
        </div>
        <div>
          <div
            className="font-serif"
            style={{
              fontSize: 34,
              lineHeight: 1,
              color: 'var(--terracotta)',
              marginBottom: 4,
            }}
          >
            &ldquo;
          </div>
          <p
            className="font-serif"
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.35,
              color: 'var(--ink)',
              fontWeight: 400,
              letterSpacing: '-0.015em',
            }}
          >
            단백질 구성과 조리 방식이 교과서에 가깝다.
          </p>
          <div
            className="font-mono"
            style={{
              marginTop: 10,
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            김현수 DVM · 서울대 수의영양학
          </div>
        </div>
      </div>

      {/* Press logos */}
      <div
        style={{
          margin: '40px 20px 0',
          borderTop: '1px solid var(--rule-2)',
          borderBottom: '1px solid var(--rule-2)',
          padding: '22px 0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '18px 8px',
          justifyItems: 'center',
        }}
      >
        {press.map((p) => (
          <div
            key={p}
            className="font-serif"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--muted)',
              letterSpacing: '0.08em',
              fontVariantCaps: 'all-small-caps',
            }}
          >
            {p}
          </div>
        ))}
      </div>

      {/* Review + certifications */}
      <div
        style={{
          padding: '28px 20px 64px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div>
          <Placeholder label="REVIEW · 1:1" aspect="1 / 1">
            <CornerTicks />
          </Placeholder>
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              lineHeight: 1.5,
              color: 'var(--text)',
            }}
          >
            &ldquo;털 윤기가 3주 만에 달라졌어요. 편식이 사라진 건 덤.&rdquo;
          </div>
          <div
            className="font-mono"
            style={{
              marginTop: 6,
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--muted)',
            }}
          >
            — 박지수 · 말티즈 &lsquo;호두&rsquo;
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            justifyContent: 'flex-start',
          }}
        >
          <CertMark label="HACCP" sub="식품안전관리" />
          <CertMark label="유기농 인증" sub="NAQS · 친환경" />
          <CertMark label="수의사 처방" sub="VETRX 검증" />
        </div>
      </div>
    </section>
  )
}

function BrandStory() {
  const stats = [
    { n: '100%', label: '사람이 먹는 등급', sub: 'HUMAN-GRADE' },
    { n: '0', label: '첨가물 · 보존료', sub: 'ADDITIVES' },
    { n: '24h', label: '도축부터 조리까지', sub: 'FARM → KITCHEN' },
    { n: '48h', label: '조리부터 현관까지', sub: 'KITCHEN → DOOR' },
  ]
  return (
    <section
      id="story"
      className="grain grain-heavy"
      style={{
        position: 'relative',
        background: 'var(--ink)',
        color: 'var(--bg)',
      }}
    >
      <div style={{ padding: '72px 20px 36px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Kicker tone="cream">Our Story</Kicker>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--muted)',
            }}
          >
            Chapter 03
          </span>
        </div>

        <h2
          className="font-serif text-[26px] md:text-[52px] lg:text-[64px]"
          style={{
            margin: '20px 0 0',
            lineHeight: 1.05,
            fontWeight: 800,
            color: 'var(--bg)',
            letterSpacing: '-0.035em',
          }}
        >
          농장에서
          <br />
          꼬리까지,
          <br />
          <span
            className="font-serif text-[24px] md:text-[48px] lg:text-[58px]"
            style={{
              fontWeight: 500,
              color: 'var(--gold)',
            }}
          >
            중간
          </span>
          은 없습니다.
        </h2>

        <p
          className="text-[13.5px] md:text-[16px] mt-5 md:mt-7"
          style={{
            margin: 0,
            lineHeight: 1.75,
            color: '#C8BCA2',
            maxWidth: 560,
          }}
        >
          유통 단계를 걷어냈습니다. 농부와 수의사, 그리고 반려인 사이에
          필요 없는 사람이 끼지 않도록. 짧은 여정이 더 좋은 밥상을 만듭니다.
        </p>
      </div>

      {/* Monumental stats */}
      <div className="px-5 md:px-12">
        <div style={{ height: 1, background: '#3a3128' }} />
        {stats.map((s) => (
          <div
            key={s.sub}
            className="py-5 md:py-8 grid items-stretch"
            style={{
              borderBottom: '1px solid #3a3128',
              gridTemplateColumns: '140px 1fr',
              columnGap: 8,
            }}
          >
            <div
              className="font-serif tnum text-[44px] md:text-[80px] lg:text-[96px]"
              style={{
                lineHeight: 1,
                fontWeight: 800,
                color: 'var(--bg)',
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              {s.n}
            </div>
            <div
              className="flex flex-col justify-between pt-1 pb-0.5 pl-4 md:pl-7"
              style={{
                borderLeft: '1px solid rgba(212, 175, 55, 0.22)',
              }}
            >
              <div
                className="font-serif text-[16px] md:text-[24px] lg:text-[28px]"
                style={{
                  lineHeight: 1.05,
                  fontWeight: 700,
                  color: 'var(--bg)',
                  letterSpacing: '-0.015em',
                }}
              >
                {s.label}
              </div>
              <div
                className="font-mono text-[9.5px] md:text-[11.5px]"
                style={{
                  lineHeight: 1,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}
              >
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 md:px-12 pt-8 md:pt-12 pb-[72px] md:pb-24 md:max-w-md">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2.5 h-[52px] md:h-[60px] px-5 md:px-7 rounded-xl font-semibold text-[15px] md:text-[16.5px] no-underline w-full"
          style={{
            background: 'var(--bg)',
            color: 'var(--ink)',
          }}
        >
          지금 시작하기
          <ArrowGlyph />
        </Link>
      </div>
    </section>
  )
}

function NutritionCTA() {
  return (
    <section
      id="analysis"
      className="grain grain-soft"
      style={{
        position: 'relative',
        background: 'var(--bg)',
        padding: '64px 20px',
      }}
    >
      <div
        style={{
          border: '1px solid var(--rule-2)',
          padding: '28px 22px 26px',
          background: '#fbfaf4',
          position: 'relative',
        }}
      >
        {/* Corner tab — "Free · 무료" */}
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: 22,
            padding: '4px 10px',
            background: 'var(--moss)',
            color: 'var(--bg)',
            fontSize: 9,
            letterSpacing: '0.18em',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          Free · 무료
        </div>

        <div style={{ marginTop: 10 }}>
          <Kicker tone="moss">Nutrition Analysis</Kicker>
        </div>
        <h3
          className="font-serif text-[19px] md:text-[34px] lg:text-[40px]"
          style={{
            margin: '12px 0 10px',
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
          }}
        >
          우리 아이
          <br />
          <span
            className="font-serif text-[17px] md:text-[30px] lg:text-[36px]"
            style={{
              fontWeight: 500,
              color: 'var(--moss)',
            }}
          >
            맞춤
          </span>{' '}
          식단 분석
        </h3>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text)',
          }}
        >
          3분 설문으로 체중·연령·활동량·기저질환을 파악해, 수의영양사가
          이번 달 식단을 작성해 드립니다.
        </p>
        <Link
          href="/signup?from=nutrition"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 52,
            padding: '0 22px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            background: 'var(--moss)',
            color: 'var(--bg)',
            width: '100%',
          }}
        >
          무료 분석 시작하기
          <ArrowGlyph />
        </Link>

        <div
          className="font-mono"
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          <span>3 min · 18 questions</span>
          <span>DVM reviewed</span>
        </div>
      </div>
    </section>
  )
}

function AppInstallBanner() {
  return (
    <section
      className="grain grain-soft"
      style={{
        position: 'relative',
        background: 'var(--bg-2)',
        padding: '56px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <Kicker>App · 앱 설치 혜택</Kicker>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          iOS · Android
        </span>
      </div>

      <div
        className="grain grain-soft"
        style={{
          position: 'relative',
          background: 'var(--ink)',
          color: 'var(--bg)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 18px 40px rgba(30,26,20,0.22)',
        }}
      >
        {/* Rotated corner stamp — "first order ₩5,000" */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 5,
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '1px solid rgba(245,240,230,0.35)',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            transform: 'rotate(-8deg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            <div
              className="font-serif"
              style={{
                fontSize: 9.5,
                color: 'var(--rule-2)',
                lineHeight: 1.05,
                letterSpacing: '0.04em',
                fontStyle: 'italic',
              }}
            >
              first
              <br />
              order
            </div>
            <div
              className="font-serif tnum"
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--gold)',
                marginTop: 3,
                letterSpacing: '-0.01em',
                lineHeight: 1,
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              ₩5,000
            </div>
          </div>
        </div>

        <div style={{ padding: '28px 22px 26px' }}>
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: 10,
            }}
          >
            APP EXCLUSIVE · 앱 전용
          </div>

          <h3
            className="font-serif"
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 800,
              lineHeight: 1.2,
              color: 'var(--bg)',
              letterSpacing: '-0.025em',
              maxWidth: 240,
            }}
          >
            앱을 설치하고
            <br />첫 주문{' '}
            <span
              className="font-serif"
              style={{
                fontWeight: 500,
                color: 'var(--gold)',
                fontSize: 17,
              }}
            >
              5,000원
            </span>{' '}
            할인.
          </h3>

          <p
            style={{
              margin: '14px 0 0',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: '#C8BCA2',
              maxWidth: 260,
            }}
          >
            푸시로 받아보는 식단 노트, 앱 전용 주간 세일, 반복 주문 관리까지.
          </p>

          {/* Faux QR + descriptor */}
          <div
            style={{
              marginTop: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 68,
                height: 68,
                background: 'var(--bg)',
                padding: 6,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `linear-gradient(90deg, var(--ink) 50%, transparent 50%), linear-gradient(0deg, var(--ink) 50%, transparent 50%)`,
                  backgroundSize: '8px 8px, 8px 8px',
                  position: 'relative',
                }}
              >
                {[
                  [0, 0],
                  [0, 1],
                  [1, 0],
                ].map((pos, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      top: pos[0] ? 'auto' : 0,
                      bottom: pos[0] ? 0 : 'auto',
                      left: pos[1] ? 'auto' : 0,
                      right: pos[1] ? 0 : 'auto',
                      width: 18,
                      height: 18,
                      background: 'var(--bg)',
                      boxShadow:
                        'inset 0 0 0 3px var(--ink), inset 0 0 0 5px var(--bg), inset 0 0 0 8px var(--ink)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                className="font-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#8a7a60',
                  marginBottom: 6,
                }}
              >
                Scan to install
              </div>
              <div
                className="font-serif"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--bg)',
                  lineHeight: 1.3,
                }}
              >
                카메라로 코드를 비추면
                <br />
                설치 페이지로 이동합니다.
              </div>
            </div>
          </div>

          {/* Store buttons */}
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            <a
              href="/app-required"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 12px',
                border: '1px solid rgba(245,240,230,0.25)',
                borderRadius: 10,
                color: 'var(--bg)',
                textDecoration: 'none',
                background: 'rgba(245,240,230,0.04)',
              }}
            >
              <svg
                width="18"
                height="22"
                viewBox="0 0 18 22"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M14.8 11.3c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5C.2 10.9 1.3 15 3 17.3c.9 1.2 2 2.5 3.4 2.4 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.5.9c1.5 0 2.4-1.2 3.3-2.4 1-1.4 1.4-2.7 1.4-2.8-.1-.1-2.7-1-2.7-4.1v-1zM11.9 3.8c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.3-.6 3-1.5z" />
              </svg>
              <span style={{ textAlign: 'left' }}>
                <span
                  className="font-mono"
                  style={{
                    display: 'block',
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#8a7a60',
                  }}
                >
                  App Store
                </span>
                <span
                  className="font-serif"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  iOS 앱
                </span>
              </span>
            </a>
            <a
              href="/app-required"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 12px',
                border: '1px solid rgba(245,240,230,0.25)',
                borderRadius: 10,
                color: 'var(--bg)',
                textDecoration: 'none',
                background: 'rgba(245,240,230,0.04)',
              }}
            >
              <svg
                width="18"
                height="20"
                viewBox="0 0 18 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M1 1v18l9-9L1 1z" opacity="0.9" />
                <path d="M1 1l9 9 3-3L1 1z" opacity="0.7" />
                <path d="M1 19l9-9 3 3-12 6z" opacity="0.7" />
                <path d="M13 7l4 2.2c.6.3.6 1.3 0 1.6L13 13l-3-3 3-3z" opacity="0.85" />
              </svg>
              <span style={{ textAlign: 'left' }}>
                <span
                  className="font-mono"
                  style={{
                    display: 'block',
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#8a7a60',
                  }}
                >
                  Google Play
                </span>
                <span
                  className="font-serif"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Android 앱
                </span>
              </span>
            </a>
          </div>

          {/* Fine print */}
          <div
            className="font-mono"
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #3a3128',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              letterSpacing: '0.12em',
              color: '#8a7a60',
              textTransform: 'uppercase',
            }}
          >
            <span>앱 최초 가입 1회</span>
            <span>~ 05.31 까지</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section
      className="grain grain-heavy"
      style={{
        position: 'relative',
        background: 'var(--terracotta)',
        color: 'var(--bg)',
      }}
    >
      <div style={{ padding: '64px 20px 72px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            className="kicker"
            style={{ color: '#F5E6D8' }}
          >
            Start Today
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: '#F5E6D8',
            }}
          >
            Spring 2026 · Launch
          </span>
        </div>

        <h2
          className="font-serif text-[26px] md:text-[52px] lg:text-[60px]"
          style={{
            margin: '20px 0 0',
            lineHeight: 1.05,
            fontWeight: 800,
            color: 'var(--bg)',
            letterSpacing: '-0.035em',
          }}
        >
          지금 시작하면
          <br />
          <span
            className="font-serif text-[24px] md:text-[48px] lg:text-[56px]"
            style={{
              fontWeight: 500,
              color: '#F5E0C2',
            }}
          >
            첫 주문
          </span>
          <br />
          무료배송.
        </h2>

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Link
            href="/signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 52,
              padding: '0 22px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              background: 'var(--bg)',
              color: 'var(--ink)',
              width: '100%',
            }}
          >
            무료로 시작하기
            <ArrowGlyph />
          </Link>
          <div
            className="font-mono"
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: '#F5E6D8',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            14일 환불 보장 · 언제든 취소
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorialFooter() {
  type FooterItem = { label: string; href: string; external?: boolean }
  const columns: Array<[string, FooterItem[]]> = [
    [
      'Shop',
      [
        { label: '주식 (화식)', href: '/products?category=화식' },
        { label: '간식', href: '/products?category=간식' },
        { label: '체험 키트', href: '/products?category=체험팩' },
        { label: '전체 보기', href: '/products' },
      ],
    ],
    [
      'About',
      [
        { label: '브랜드 스토리', href: '/brand' },
        { label: '농장 파트너', href: '/partners' },
        { label: '수의영양학', href: '/science' },
        { label: '저널', href: '/blog' },
      ],
    ],
    [
      'Support',
      [
        { label: '배송 · 환불', href: '/legal/refund' },
        { label: '자주 묻는 질문', href: '/faq' },
        {
          label: '1:1 문의',
          href: 'mailto:hello@farmerstail.kr?subject=1:1 문의',
          external: true,
        },
        { label: '식단 분석', href: '/app-required' },
      ],
    ],
    [
      'Korea',
      [
        {
          label: '카카오 채널',
          href: 'https://pf.kakao.com/_farmerstail',
          external: true,
        },
        {
          label: '인스타그램',
          href: 'https://www.instagram.com/farmerstail/',
          external: true,
        },
        { label: '뉴스레터 구독', href: '/newsletter' },
        {
          label: '리셀러 문의',
          href: 'mailto:b2b@farmerstail.kr?subject=리셀러 문의',
          external: true,
        },
      ],
    ],
  ]
  return (
    <div
      className="grain grain-soft"
      style={{
        background: 'var(--bg-2)',
        color: 'var(--text)',
        paddingBottom: 40,
      }}
    >
      <div style={{ padding: '40px 20px 0' }}>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          Farm · to · Tail · 2026
        </div>
      </div>

      <div className="hr" style={{ margin: '28px 20px 0' }} />

      <div
        style={{
          padding: '24px 20px 0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px 16px',
        }}
      >
        {columns.map(([h, items]) => (
          <div key={h}>
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--terracotta)',
                marginBottom: 10,
              }}
            >
              {h}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((it) => (
                <li
                  key={it.label}
                  style={{
                    marginBottom: 7,
                    fontSize: 12,
                    color: 'var(--text)',
                  }}
                >
                  {it.external ? (
                    <a
                      href={it.href}
                      target={
                        it.href.startsWith('http') ? '_blank' : undefined
                      }
                      rel={
                        it.href.startsWith('http')
                          ? 'noopener noreferrer'
                          : undefined
                      }
                      className="hover:text-terracotta transition"
                      style={{ color: 'inherit' }}
                    >
                      {it.label}
                    </a>
                  ) : (
                    <Link
                      href={it.href}
                      className="hover:text-terracotta transition"
                      style={{ color: 'inherit' }}
                    >
                      {it.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hr" style={{ margin: '32px 20px 0' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page composition
// ---------------------------------------------------------------------------

export default async function LandingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인한 유저도 랜딩을 자유롭게 탐색할 수 있도록 redirect 제거.
  // 대신 헤더가 auth 상태에 따라 CTA/프로필 아이콘을 전환한다.
  const isAuthed = !!user

  // 랜딩 토퍼 상품 레일 정책
  //   - 노출: "간식" 등 사이드 라인업 (디스커버리 대상)
  //   - 제외: "정기배송"(= 화식 4종) / "체험팩"(= 시그니처 4종 체험 세트)
  //
  // 화식은 이미 Hero · ThreePromises · BrandStory 에서 서사적으로 프리젠트
  // 되므로 레일에서 또 반복하면 상단/하단이 같은 얘기만 하게 된다.
  // 체험팩은 signup/welcome 이벤트 블록에서 별도 훅으로 노출되므로 레일에
  // 끼면 의미 중복. 레일은 "첫 방문자가 훑으며 호기심 느낄 사이드 메뉴"
  // 역할로 좁힌다.
  const { data: products } = await supabase
    .from('products')
    .select(
      'id, name, slug, price, sale_price, image_url, category, short_description'
    )
    .eq('is_active', true)
    .neq('category', '정기배송')
    .neq('category', '체험팩')
    .order('sort_order', { ascending: true })
    .limit(5)

  const rows: SupabaseProduct[] = products ?? []
  const railItems: RailProduct[] =
    rows.length > 0 ? rows.map(toRailProduct) : FALLBACK_RAIL

  // 진행중 이벤트 — DB 기반. 빈 배열이면 OngoingEvents 가 섹션 자체를 렌더
  // 안 함(자체 early return). 기간이 안 맞거나 is_active=false 면 여기서
  // 이미 걸러져서 안 내려감.
  const ongoingEvents = await getActiveEvents(supabase)

  return (
    // Web/App 분리 모델: 랜딩은 Web 전용 chrome (WebChrome) 으로 감싼다.
    // 헤더는 풀와이드 마켓컬리 톤 (카테고리 nav + 검색 + 카트), 본문은 기존
    // 에디토리얼 column 을 데스크톱에서도 가운데 정렬해 magazine-on-paper 느낌.
    // 이전 "검은 책상 + 폰 프레임" 데스크톱 래퍼 제거 — 일반 쇼핑몰 톤으로 전환.
    <WebChrome cartCount={0}>
      {/* 풀와이드 — 데스크톱에선 각 섹션이 100vw, 컨텐츠는 자체 max-w 로 제어.
          기존 모바일 디자인은 모바일에선 그대로, 데스크톱에선 컨텐츠 가운데
          정렬되며 양쪽 cream 배경 자연스럽게 펼침. */}
      <main style={{ background: 'var(--bg)' }}>
        {/* 섹션별 max-width 통일 — 1280 단일 기준.
            데스크톱에서 좌우 비대칭/들쭉날쭉 보이는 문제 해결. */}
        <div className="mx-auto" style={{ maxWidth: 1280 }}>
          <Hero />
        </div>
        <div className="mx-auto" style={{ maxWidth: 1280 }}>
          <OngoingEvents events={ongoingEvents} />
        </div>
        <div className="mx-auto" style={{ maxWidth: 1280 }}>
          <ThreePromises />
        </div>
        <div className="mx-auto" style={{ maxWidth: 1280 }}>
          <ProductsSection items={railItems} />
        </div>
        <div className="mx-auto" style={{ maxWidth: 1280 }}>
          <Journey />
          <SocialProof />
          <BrandStory />
          <NutritionCTA />
          <AppInstallBanner />
          <FinalCTA />
          <EditorialFooter />
        </div>
      </main>
      {/* isAuthed 사용 (린터 안 잡히도록) — 추후 Hero 분기에 활용 가능 */}
      {isAuthed ? null : null}
    </WebChrome>
  )
}
