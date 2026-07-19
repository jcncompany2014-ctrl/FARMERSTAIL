import type { Metadata } from 'next'
import { ArrowRight, Quote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import Reveal from '@/components/landing/Reveal'
import StickyCta from '@/components/web/fd/StickyCta'
import FdSlider from '@/components/web/fd/FdSlider'
import JsonLd from '@/components/JsonLd'
import { buildBreadcrumbJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
  Stat,
} from '@/components/web/fd/ui'

/**
 * 웹 후기 — /reviews (The Farmer's Dog /reviews 실구조 복제, 2026-06-13 재구축).
 *
 * FD /reviews 구조: 히어로 → 강아지 로스터 슬라이더 → 평점 밴드 → 카테고리
 * 필터 탭(7) → 후기 그리드 → 스포트라이트 → 전문가 보증 슬라이더 → 신뢰 → CTA.
 * ⚠️ 정직 원칙: 가짜 후기·평점·숫자·보증 절대 금지. 전부 placeholder(스켈레톤 +
 * "후기 준비 중"). 사진 PhotoSlot. 모든 CTA → 설문 퍼널.
 */

export const revalidate = 3600

// R99-A 패턴: Next openGraph shallow-merge 라 페이지가 images 미지정 시 layout
// 기본 OG 상속 못 함 → 공유 카드 썸네일 0. 명시 OG 추가(회차161).
const REVIEWS_OG = ogImageUrl({
  title: '보호자들의 진짜 이야기',
  subtitle: '지어낸 후기 없이, 실제 경험만',
  tag: 'Reviews',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차150).
  title: '후기 — 보호자들의 진짜 이야기',
  description:
    '파머스테일을 먹은 아이와 보호자의 실제 후기가 이 자리에 모입니다. 지어낸 후기 대신 진짜 경험만. 2분 설문으로 직접 확인해 보세요.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: '후기 — 보호자들의 진짜 이야기 | 파머스테일',
    description:
      '파머스테일을 먹은 아이와 보호자의 실제 후기가 이 자리에 모입니다. 지어낸 후기 대신 진짜 경험만.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/reviews',
    images: [{ url: REVIEWS_OG, width: 1200, height: 630, alt: '후기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '후기 — 보호자들의 진짜 이야기 | 파머스테일',
    description: '지어낸 후기 대신 진짜 경험만.',
    images: [REVIEWS_OG],
  },
}

function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/start'
}

function StarDots() {
  // 정직: 평점 미공개 상태이므로 '빈' 아웃라인 dots(채운 별 = 5점 평점 암시 금지).
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: 'transparent', border: '1.5px solid var(--fd-line)', display: 'inline-block' }} />
      ))}
    </div>
  )
}

// 1. Hero ====================================================================
function ReviewsHero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="lg">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 680 }}>
            <Eyebrow>REVIEWS</Eyebrow>
            <Display as="h1" size="xl" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
              보호자들의
              <br />
              진짜 이야기
            </Display>
            <p className="pt-5 mx-auto text-[15px] md:text-[18px]" style={{ maxWidth: 480, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
              지어낸 후기는 한 줄도 싣지 않아요. 실제 후기가 모이면 이 자리에
              그대로 담깁니다. 먼저 우리 아이로 직접 확인해 보세요.
            </p>
            <div className="pt-7 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <StarDots />
                <span className="text-[13px]" style={{ fontWeight: 700, color: 'var(--fd-muted)' }}>후기 준비 중</span>
              </div>
              <p className="text-[12.5px]" style={{ color: 'var(--fd-muted)', opacity: 0.85 }}>
                아직 후기를 수집하기 전이에요. 평점은 실제 후기가 쌓이면 공개됩니다.
              </p>
            </div>
            {/* 듀얼 CTA — 홈 hero 와 동일 패턴(주 설문 + 보조 '우리 음식 보기').
                보조는 아직 설문 전인 방문자를 위한 learn-more 경로 겸 내부링크. */}
            <div className="pt-7 flex flex-wrap justify-center gap-3">
              <Button href={planHref(isAuthed)} tone="coral" size="lg">
                2분 설문 시작하기
                <ArrowRight size={19} strokeWidth={2.4} />
              </Button>
              <Button href="/our-food" tone="outline" size="lg">
                우리 음식 보기
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 2. Dog roster slider (FD: 아이 이름·지역 로스터)
// ⚠️ 테스트 예시 데이터 — 실제 후기/고객 아님. 실 데이터 연동 전 화면 확인용.
const EXAMPLE_DOGS = [
  { img: '/dog-portrait.jpg', name: '보리', region: '서울 · 골든리트리버' },
  { img: '/dog-corgi.jpg', name: '초코', region: '경기 · 웰시코기' },
  { img: '/dog-poodle.jpg', name: '몽이', region: '부산 · 푸들' },
  { img: '/dog-maltese.jpg', name: '뭉치', region: '인천 · 말티즈' },
  { img: '/dog-mixed.jpg', name: '해피', region: '대구 · 믹스견' },
  { img: '/dog-corgi.jpg', name: '두부', region: '광주 · 웰시코기' },
  { img: '/dog-poodle.jpg', name: '라떼', region: '대전 · 푸들' },
  { img: '/dog-portrait.jpg', name: '골디', region: '울산 · 리트리버' },
]

/** 테스트/예시 데이터임을 알리는 작은 배지. 실 데이터 연동 시 제거. */
function TestBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: 'var(--fd-muted)',
        background: 'var(--fd-cream)',
        border: '1px solid var(--fd-line)',
        borderRadius: 999,
        padding: '2px 8px',
        letterSpacing: '0.02em',
      }}
    >
      테스트 예시
    </span>
  )
}

function DogCard({
  img,
  name,
  region,
}: {
  img: string
  name: string
  region: string
}) {
  return (
    <div className="snap-start shrink-0 w-[160px] md:w-[180px] text-center" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '16px 14px' }}>
      <PhotoSlot src={img} alt={name} label="아이 사진" ratio="1 / 1" tone="cream" rounded={999} className="w-full" />
      <p className="pt-3 text-[13px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>{name}</p>
      <p className="pt-0.5 text-[11.5px]" style={{ color: 'var(--fd-muted)', fontWeight: 600 }}>{region}</p>
    </div>
  )
}

function DogRoster() {
  return (
    <Section bg="cream" pad="sm">
      <Container size="xl">
        <Reveal>
          <p className="text-center text-[13px] flex items-center justify-center gap-2 flex-wrap" style={{ fontWeight: 700, color: 'var(--fd-muted)', letterSpacing: '0.04em' }}>
            먹어본 아이들이 이 자리에 모여요
            <TestBadge />
          </p>
        </Reveal>
        <div className="pt-5">
          <Reveal>
            <FdSlider ariaLabel="아이 로스터">
              {EXAMPLE_DOGS.map((d, i) => (
                <DogCard key={i} {...d} />
              ))}
            </FdSlider>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 3. Category filter tabs (FD 7 카테고리, 시각 placeholder) ==================
const FILTERS = ['전체 건강', '자견 케어', '시니어 케어', '체중', '소화', '편식', '피부·모질'] as const

function FilterTabs() {
  return (
    <Section bg="white" pad="sm">
      <Container size="xl">
        <Reveal>
          <div className="flex flex-nowrap md:flex-wrap items-center justify-start md:justify-center gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 md:mx-0 md:px-0" role="presentation">
            {FILTERS.map((f, i) => {
              const active = i === 0
              return (
                <button
                  key={f}
                  type="button"
                  aria-disabled
                  tabIndex={-1}
                  className="inline-flex shrink-0 items-center rounded-full text-[13px] md:text-[14px]"
                  style={{
                    height: 40,
                    padding: '0 18px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    cursor: 'default',
                    whiteSpace: 'nowrap',
                    background: active ? 'var(--fd-pine)' : 'var(--fd-offwhite)',
                    color: active ? '#FFFFFF' : 'var(--fd-muted)',
                    border: active ? '1px solid var(--fd-pine)' : '1px solid var(--fd-line)',
                  }}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 4. Review grid — placeholder ==============================================
function ReviewCard() {
  return (
    <div className="h-full" style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid var(--fd-line)', padding: '24px 22px' }}>
      <StarDots />
      <div className="pt-4 flex flex-col gap-2" aria-hidden>
        <span style={{ display: 'block', height: 9, width: '94%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '88%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '72%', borderRadius: 4, background: '#EDEAE0' }} />
      </div>
      <div className="pt-5 flex items-center gap-3">
        <span style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--fd-cream)', display: 'inline-block' }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fd-muted)' }}>후기 자리 · 보호자 이름</span>
      </div>
    </div>
  )
}

function ReviewGrid() {
  const cards = Array.from({ length: 9 })
  return (
    <Section bg="offwhite">
      <Container size="xl">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {cards.map((_, i) => (
            <Reveal key={i} delay={Math.min(i, 5) * 70}>
              <ReviewCard />
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="pt-9 text-center text-[13px]" style={{ color: 'var(--fd-muted)', fontWeight: 600 }}>
            실제 후기가 등록되면 위 자리부터 차례로 채워집니다.
          </p>
        </Reveal>
      </Container>
    </Section>
  )
}

// 5. Featured story (FD 스포트라이트) =======================================
function FeaturedReview() {
  return (
    <Section bg="white">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>FEATURED STORY</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              먼저 만나볼 후기 자리
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 440, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
              인상 깊은 후기는 사진과 함께 이 자리에 크게 소개할 예정이에요.
            </p>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
          <Reveal>
            <PhotoSlot src="/review-owner-dog.jpg" alt="화식을 잘 먹는 강아지와 보호자" label="후기 보호자와 아이 사진" sub="잘 먹는 우리 아이 / 보호자 인터뷰 컷" ratio="4 / 3" tone="cream" rounded={10} className="w-full" />
          </Reveal>
          <Reveal delay={100}>
            <div>
              <Quote size={34} strokeWidth={2.2} color="var(--fd-coral)" aria-hidden />
              <div className="pt-5 flex flex-col gap-2.5" aria-hidden>
                <span style={{ display: 'block', height: 12, width: '96%', borderRadius: 4, background: '#EDEAE0' }} />
                <span style={{ display: 'block', height: 12, width: '90%', borderRadius: 4, background: '#EDEAE0' }} />
                <span style={{ display: 'block', height: 12, width: '93%', borderRadius: 4, background: '#EDEAE0' }} />
                <span style={{ display: 'block', height: 12, width: '64%', borderRadius: 4, background: '#EDEAE0' }} />
              </div>
              <div className="pt-7 flex items-center gap-3">
                <span style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--fd-cream)', display: 'inline-block' }} />
                <div className="flex flex-col gap-1.5">
                  <span style={{ display: 'block', height: 10, width: 120, borderRadius: 4, background: '#EDEAE0' }} aria-hidden />
                  <span style={{ display: 'block', height: 9, width: 88, borderRadius: 4, background: '#EDEAE0' }} aria-hidden />
                </div>
              </div>
              <p className="pt-6 text-[12.5px]" style={{ color: 'var(--fd-muted)', fontWeight: 600 }}>
                후기 준비 중 · 실제 보호자 인터뷰로 채워집니다
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 6. Professional endorsement slider (FD 전문가 보증) — placeholder =========
function ProCard() {
  return (
    <div className="snap-start shrink-0 w-[280px] md:w-[360px]" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '24px 22px' }}>
      <Quote size={26} strokeWidth={2} color="var(--fd-coral)" aria-hidden />
      <div className="pt-4 flex flex-col gap-2" aria-hidden>
        <span style={{ display: 'block', height: 9, width: '92%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '84%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '66%', borderRadius: 4, background: '#EDEAE0' }} />
      </div>
      <div className="pt-5 flex items-center gap-3">
        <span style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--fd-cream)', display: 'inline-block' }} />
        <span className="text-[12.5px]" style={{ fontWeight: 700, color: 'var(--fd-muted)' }}>수의 자문 자리 · 직함</span>
      </div>
    </div>
  )
}

function ProEndorsement() {
  return (
    <Section bg="cream" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>PROFESSIONALS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              전문가의 시선으로
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 460, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
              수의 자문과 전문가 의견이 모이면 이 자리에 채워집니다.
            </p>
          </div>
        </Reveal>
        <div className="pt-9">
          <Reveal>
            <FdSlider ariaLabel="전문가 의견">
              <ProCard />
              <ProCard />
              <ProCard />
              <ProCard />
            </FdSlider>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 7. Stat band — 정직(준비 중 / —) ==========================================
const STATS: { value: string; label: string }[] = [
  { value: '준비 중', label: '등록된 후기 수' },
  { value: '—', label: '평균 평점' },
  { value: '준비 중', label: '재구매 의향' },
]

function StatBand() {
  return (
    <Section bg="pine">
      <Container size="lg">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 560 }}>
            <Eyebrow color="var(--fd-green-soft)">BY THE NUMBERS</Eyebrow>
            <Display size="md" className="pt-3" style={{ color: '#FFFFFF' }}>
              숫자도 정직하게
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 420, color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>
              후기가 충분히 모이기 전까지는 어떤 수치도 지어내지 않아요. 채워지는
              순간 이 자리에 그대로 공개합니다.
            </p>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid grid-cols-3 gap-4 md:gap-8">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <Stat value={s.value} label={s.label} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// 8. Final CTA ==============================================================
function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="coral">
      <Container size="md">
        <Reveal>
          <div className="text-center">
            <Display size="lg" style={{ color: '#FFFFFF' }}>
              직접 확인해 보세요
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 420, lineHeight: 1.65, color: 'rgba(255,255,255,0.92)' }}>
              남의 후기보다 우리 아이의 한 끼가 가장 정확한 후기예요. 2분 설문으로
              지금 시작해요.
            </p>
            <div className="pt-8 flex justify-center">
              <Button href={planHref(isAuthed)} tone="cream" size="lg">
                2분 설문 시작하기
                <ArrowRight size={19} strokeWidth={2.4} />
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// Page =======================================================================
export default async function ReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '후기', path: '/reviews' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-reviews-crumbs" data={crumbLd} />
        <ReviewsHero isAuthed={isAuthed} />
        <DogRoster />
        <FilterTabs />
        <ReviewGrid />
        <FeaturedReview />
        <ProEndorsement />
        <StatBand />
        <FinalCta isAuthed={isAuthed} />
      </main>
      <StickyCta href={planHref(isAuthed)} />
    </WebChrome>
  )
}
