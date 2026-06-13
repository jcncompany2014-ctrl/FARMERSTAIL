import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import Reveal from '@/components/landing/Reveal'
import { ScribbleUnderline } from '@/components/landing/Scribble'
import { JourneyDefs } from '@/components/landing/journey/PlaceholderArt'
import TruckDrive from '@/components/landing/journey/TruckDrive'
import TruckArrival from '@/components/landing/journey/TruckArrival'
import CountUp from '@/components/landing/journey/CountUp'
import Marquee, { type MarqueeItem } from '@/components/landing/journey/Marquee'

type Sku = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  short_description: string | null
}

/**
 * 웹 랜딩 — Farm v4 / "원물 트럭의 여정" (Phase Q8, 2026-06-12).
 *
 * 뼈대: 원물 트럭이 농장에서 우리에게 오는 스크롤 서사. 트럭이 3번에 걸쳐
 * 언덕을 넘으며 점점 가까워지고(작게→크게), 주행 사이사이 콘텐츠가 끼어든다.
 * 마지막에 정면 도착 → CTA(설문).
 *
 *   [Hero] 타이틀 → [A]주행1 → [콘텐츠1] → [B]주행2 → [콘텐츠2] →
 *   [C]주행3 → [콘텐츠3] → [도착] → [CTA] → [FAQ]
 *
 * ▸ 에셋: 지금은 SVG 크레용 placeholder. 그림 교체는 lib/landing/journeyConfig.ts
 *   의 src 경로만 바꾸면 됨 (코드 불변). 슬롯 번호 = 에셋 스펙 문서와 1:1.
 * ▸ 콘텐츠 섹션 1/2/3 은 이번 단계에선 placeholder (TODO). 실제 SKU 스택·
 *   카운트업·마퀴 갤러리는 다음 단계(Phase Q9)에서 제작.
 * ▸ 모션: 스크롤 연동 transform/opacity 만, rAF 스로틀, reduced-motion 대응.
 */

export const revalidate = 300

export const metadata: Metadata = {
  title: '파머스테일 — 농장에서 온 우리 아이의 진짜 한 끼',
  description:
    '농장에서 출발한 원물이 우리 아이 식탁까지. 2분 설문이면 맞춤 식단과 하루 가격을 바로 확인할 수 있어요. 체험팩부터 부담 없이.',
  alternates: { canonical: '/' },
  openGraph: {
    title: '파머스테일 — 농장에서 온 우리 아이의 진짜 한 끼',
    description:
      '농장에서 출발한 원물이 우리 아이 식탁까지. 2분 설문이면 맞춤 식단과 하루 가격을 바로 확인할 수 있어요.',
    url: '/',
  },
}

// ---------------------------------------------------------------------------
// 공용 소품
// ---------------------------------------------------------------------------

/** 설문 퍼널 진입 경로 — 모든 CTA 가 이 한 곳으로 수렴한다. */
function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/signup'
}

/** 섹션 라벨 — 손글씨(개구체), 포인트 전용. */
function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-center text-[18px]"
      style={{
        fontFamily: "var(--font-hand), 'Gaegu', cursive",
        color: 'var(--terracotta)',
        fontWeight: 700,
      }}
    >
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// 1. 히어로 — 타이틀 카드 (CTA 는 헤더 상시 + 마지막 도착에서 페이오프)
// ---------------------------------------------------------------------------

function FarmHero() {
  return (
    <section
      className="px-6 pt-16 md:pt-24 pb-12 md:pb-16 text-center"
      style={{ background: 'var(--bg)' }}
    >
      <h1
        className="fv-rise text-[33px] md:text-[56px] lg:text-[64px]"
        style={{
          margin: '0 auto',
          maxWidth: 760,
          lineHeight: 1.24,
          fontWeight: 900,
          color: 'var(--ink)',
          letterSpacing: '-0.03em',
        }}
      >
        농장에서 만든
        <br />
        우리 아이의 <ScribbleUnderline>진짜</ScribbleUnderline> 한 끼
      </h1>

      <p
        className="fv-rise fv-rise-2 text-[15px] md:text-[17px]"
        style={{
          margin: '18px auto 0',
          maxWidth: 440,
          lineHeight: 1.7,
          color: 'var(--muted-strong)',
        }}
      >
        농장에서 출발한 원물이
        <br className="md:hidden" /> 우리 아이 식탁까지 오는 길.
      </p>

      <div
        className="fv-rise fv-rise-3 pt-10 flex flex-col items-center gap-1.5"
        style={{ color: 'var(--muted)' }}
      >
        <span className="text-[12px]" style={{ letterSpacing: '0.04em' }}>
          스크롤해서 따라와 보세요
        </span>
        <ChevronDown className="fv-bounce" size={22} strokeWidth={2} />
      </div>
    </section>
  )
}

/** 섹션 제목 묶음 — 손글씨 kicker + 고딕 헤비 h2. */
function SectionHead({
  kicker,
  title,
  sub,
}: {
  kicker: string
  title: string
  sub?: string
}) {
  return (
    <div className="text-center">
      <SectionKicker>{kicker}</SectionKicker>
      <h2
        className="pt-2 text-[24px] md:text-[34px] mx-auto"
        style={{
          maxWidth: 620,
          fontWeight: 900,
          color: 'var(--ink)',
          letterSpacing: '-0.03em',
          lineHeight: 1.28,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          className="pt-3 text-[13.5px] md:text-[15px] mx-auto"
          style={{ maxWidth: 460, color: 'var(--muted-strong)', lineHeight: 1.65 }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 콘텐츠 1 — 농장에서 온 원물
// ---------------------------------------------------------------------------

const VEG_CHIPS: { label: string; color: string }[] = [
  { label: '단호박', color: '#E08A3C' },
  { label: '당근', color: '#D86A2E' },
  { label: '브로콜리', color: '#6B7F3A' },
  { label: '잎채소', color: '#7C9442' },
]

function Content1() {
  return (
    <section
      className="px-5 md:px-6 py-16 md:py-24"
      style={{ background: 'var(--tint-cream)' }}
    >
      <div className="max-w-[760px] mx-auto">
        <Reveal>
          <SectionHead
            kicker="농장에서"
            title="좋은 재료에서 시작합니다"
            sub="농장에서 온 재료를 사람이 먹는 기준으로 다듬고, 저온에서 천천히 익혀요."
          />
        </Reveal>
        <Reveal delay={100}>
          <div className="flex justify-center flex-wrap gap-4 md:gap-6 pt-9">
            {VEG_CHIPS.map((v) => (
              <div key={v.label} className="flex flex-col items-center gap-2">
                <span
                  className="ft-sticker flex items-center justify-center"
                  style={{
                    width: 'clamp(64px, 18vw, 84px)',
                    height: 'clamp(64px, 18vw, 84px)',
                    borderRadius: '50%',
                  }}
                >
                  <span
                    style={{
                      width: '46%',
                      height: '46%',
                      borderRadius: '50%',
                      background: v.color,
                      filter: 'url(#jr-rough)',
                    }}
                  />
                </span>
                <span
                  className="text-[12.5px] md:text-[13.5px]"
                  style={{ fontWeight: 700, color: 'var(--ink)' }}
                >
                  {v.label}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
        {/* TODO(에셋): 색칠 단순 원 → 실제 스팟 일러스트(스펙 4번)로 교체 */}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 콘텐츠 2 — 화식 + 영양 알고리즘 (실제 SKU 스티키 스택 + 카운트업)
// ---------------------------------------------------------------------------

function SkuCard({ sku, index }: { sku: Sku; index: number }) {
  const no = String(index + 1).padStart(3, '0')
  return (
    <div
      className="ft-sticker"
      style={{
        position: 'sticky',
        top: 'clamp(80px, 14vh, 110px)',
        zIndex: index + 1,
        marginBottom: 22,
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        minHeight: 168,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'clamp(96px, 26vw, 128px)',
          aspectRatio: '1 / 1',
          borderRadius: 12,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'linear-gradient(135deg, #EFE4CC 0%, #DFE4C6 100%)',
        }}
      >
        {sku.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sku.image_url}
            alt={sku.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="font-archivo"
          style={{ fontSize: 13, color: 'var(--brick)', letterSpacing: '0.04em' }}
        >
          {no}
        </span>
        <h3
          className="pt-0.5 text-[17px] md:text-[19px] truncate"
          style={{ fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {sku.name}
        </h3>
        {sku.short_description && (
          <p
            className="pt-1 text-[12.5px] md:text-[13px]"
            style={{ color: 'var(--muted-strong)', lineHeight: 1.5 }}
          >
            {sku.short_description}
          </p>
        )}
        <div className="pt-2.5 flex items-center gap-3">
          {/* TODO(단위 표기): 100g/팩 기준 — 사장님 확정 */}
          <span
            className="text-[15px]"
            style={{ fontWeight: 800, color: 'var(--ink)' }}
          >
            {(sku.sale_price ?? sku.price).toLocaleString()}원
          </span>
          <Link
            href={`/products/${sku.slug}`}
            className="inline-flex items-center gap-1 no-underline text-[12.5px]"
            style={{ color: 'var(--brick)', fontWeight: 700 }}
          >
            자세히 보기
            <ArrowRight size={13} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </div>
  )
}

const NUTRI_STATS: { to: number; suffix: string; label: string }[] = [
  // TODO(수치 확정): 시스템 실제 값 기준 — 사장님 검수
  { to: 38, suffix: '종', label: '관리 영양소' },
  { to: 35, suffix: '견종', label: '맞춤 데이터' },
  { to: 2, suffix: '분', label: '설문 시간' },
]

function Content2({ skus }: { skus: Sku[] }) {
  return (
    <section
      className="px-5 md:px-6 py-16 md:py-24"
      style={{ background: 'var(--tint-sage)' }}
    >
      <div className="max-w-[760px] mx-auto">
        <Reveal>
          <SectionHead
            kicker="맞춤 화식"
            title="우리 아이에게 딱 맞는 한 끼"
            sub="수의영양학 표준 공식으로, 우리 아이의 몸에 맞는 식단과 양을 계산해요."
          />
        </Reveal>

        {/* 영양 알고리즘 카운트업 */}
        <Reveal delay={100}>
          <div className="grid grid-cols-3 gap-2.5 md:gap-4 pt-9">
            {NUTRI_STATS.map((s) => (
              <div
                key={s.label}
                className="ft-sticker text-center"
                style={{ padding: '16px 8px' }}
              >
                <div
                  className="font-archivo"
                  style={{
                    fontSize: 'clamp(24px, 7vw, 34px)',
                    color: 'var(--brick)',
                    lineHeight: 1,
                  }}
                >
                  <CountUp to={s.to} suffix={s.suffix} />
                </div>
                <div
                  className="pt-1.5 text-[11.5px] md:text-[12.5px]"
                  style={{ color: 'var(--muted-strong)', fontWeight: 600 }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* SKU 스티키 카드 스택 */}
        {skus.length > 0 && (
          <div className="pt-12 md:pt-16">
            {skus.map((s, i) => (
              <SkuCard key={s.id} sku={s} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 콘텐츠 3 — 제조 현장 갤러리 (무한 마퀴 2줄)
// ---------------------------------------------------------------------------

// TODO(에셋): 실제 제조 현장 촬영본으로 교체 (정직 원칙 — 음식·현장은 실사진).
const GALLERY_ROW_A: MarqueeItem[] = [
  { label: '제조 현장 01' },
  { label: '제조 현장 02' },
  { label: '제조 현장 03' },
  { label: '제조 현장 04' },
]
const GALLERY_ROW_B: MarqueeItem[] = [
  { label: '제조 현장 05' },
  { label: '제조 현장 06' },
  { label: '제조 현장 07' },
  { label: '제조 현장 08' },
]

function Content3() {
  return (
    <section
      className="py-16 md:py-24"
      style={{ background: 'var(--tint-cream)' }}
    >
      <div className="px-5 md:px-6">
        <Reveal>
          <SectionHead
            kicker="제조 현장"
            title="이렇게 만들어요"
            sub="사진은 실제 제조 현장 촬영본으로 교체될 예정이에요."
          />
        </Reveal>
      </div>
      <div className="pt-9 flex flex-col gap-3.5">
        <Marquee items={GALLERY_ROW_A} />
        <Marquee items={GALLERY_ROW_B} reverse speedSec={36} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 도착 직후 CTA — brick 배경
// ---------------------------------------------------------------------------

function JourneyCTA({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section
      className="px-5 md:px-6 py-16 md:py-24 text-center"
      style={{ background: 'var(--brick)' }}
    >
      <Reveal>
        <h2
          className="mx-auto text-[25px] md:text-[38px]"
          style={{
            maxWidth: 620,
            fontWeight: 900,
            color: '#FFFEFA',
            letterSpacing: '-0.03em',
            lineHeight: 1.3,
          }}
        >
          이제 우리 아이 차례예요
        </h2>
        <p
          className="pt-3 text-[14px] md:text-[15.5px] mx-auto"
          style={{ maxWidth: 460, lineHeight: 1.7, color: 'rgba(255,254,250,0.86)' }}
        >
          2분 설문이면 맞춤 식단과 하루 가격을 바로 확인할 수 있어요.
          체험팩부터, 언제든 해지.
        </p>
        <div className="pt-8 flex justify-center">
          {/* TODO(Q? 버튼 인터랙션): 텍스트 스왑 호버. 지금은 sticker 버튼. */}
          <Link
            href={planHref(isAuthed)}
            className="inline-flex items-center justify-center gap-2.5 rounded-full no-underline transition active:translate-y-[1px] h-[58px] px-9 text-[16px]"
            style={{
              background: '#FFFEFA',
              color: 'var(--walnut)',
              fontWeight: 800,
              boxShadow: '0 14px 30px -12px rgba(61,43,31,0.5)',
            }}
          >
            우리 아이 플랜 보기
            <ArrowRight size={19} strokeWidth={2.4} />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FAQ 발췌
// ---------------------------------------------------------------------------

const FAQ_TEASERS = [
  '정기배송은 언제든 해지할 수 있나요?',
  '우리 아이가 안 먹으면 어떻게 하나요?',
  '재료는 어디에서 오나요?',
] as const

function FaqTeaser() {
  return (
    <section
      className="px-5 md:px-6 py-16 md:py-20"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-[680px] mx-auto">
        <Reveal>
          <SectionKicker>자주 묻는 질문</SectionKicker>
          <div className="pt-5 flex flex-col gap-2.5">
            {FAQ_TEASERS.map((q) => (
              <Link
                key={q}
                href="/faq"
                className="flex items-center justify-between rounded-2xl px-5 py-4 no-underline"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--rule-2)',
                }}
              >
                <span
                  className="text-[13.5px] md:text-[14.5px]"
                  style={{ fontWeight: 600, color: 'var(--ink)' }}
                >
                  {q}
                </span>
                <ArrowRight size={16} strokeWidth={2} color="var(--muted)" />
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
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

  // 로그인 유저도 랜딩 자유 탐색 — CTA 만 auth 상태로 분기 (기존 정책 유지).
  const isAuthed = !!user

  // 콘텐츠2 SKU 스택 — 실제 화식 제품 (가짜 카드 아님).
  const { data: hwsik } = await supabase
    .from('products')
    .select('id, name, slug, price, sale_price, image_url, short_description')
    .eq('is_active', true)
    .eq('category', '화식')
    .order('sort_order', { ascending: true })
  const skus: Sku[] = hwsik ?? []

  return (
    <WebChrome cartCount={0}>
      {/* 트럭/언덕 SVG 공유 크레용 필터 — 1회 렌더 */}
      <JourneyDefs />
      <main style={{ background: 'var(--bg)' }}>
        <FarmHero />

        <TruckDrive stage={1} />
        <Content1 />

        <TruckDrive stage={2} />
        <Content2 skus={skus} />

        <TruckDrive stage={3} />
        <Content3 />

        <TruckArrival />
        <JourneyCTA isAuthed={isAuthed} />
        <FaqTeaser />
      </main>
    </WebChrome>
  )
}
