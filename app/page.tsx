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

// ---------------------------------------------------------------------------
// 콘텐츠 섹션 placeholder (Phase Q9 에서 실제 제작)
// ---------------------------------------------------------------------------

function ContentPlaceholder({
  n,
  title,
  note,
  tint,
}: {
  n: number
  title: string
  note: string
  tint: string
}) {
  return (
    <section
      className="px-5 md:px-6 py-16 md:py-24"
      style={{ background: tint }}
    >
      <Reveal>
        <div
          className="ft-sticker max-w-[680px] mx-auto text-center px-6 md:px-10 py-10 md:py-14"
          style={{ borderStyle: 'dashed' }}
        >
          <p
            className="text-[14px]"
            style={{
              fontFamily: "var(--font-hand), 'Gaegu', cursive",
              color: 'var(--terracotta)',
              fontWeight: 700,
            }}
          >
            콘텐츠 {n}
          </p>
          <h2
            className="pt-2 text-[22px] md:text-[30px]"
            style={{
              fontWeight: 900,
              color: 'var(--ink)',
              letterSpacing: '-0.03em',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <p
            className="pt-3 text-[13px] md:text-[14px]"
            style={{ color: 'var(--muted-strong)', lineHeight: 1.65 }}
          >
            {note}
          </p>
          {/* TODO(Q9): 실제 콘텐츠(SKU 스티키 스택 / 카운트업 / 마퀴 갤러리) 제작 */}
        </div>
      </Reveal>
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
            className="ft-sticker inline-flex items-center justify-center gap-2.5 no-underline transition active:translate-y-[2px] active:shadow-none h-[58px] px-9 text-[16px]"
            style={{ color: 'var(--walnut)', fontWeight: 800 }}
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

  return (
    <WebChrome cartCount={0}>
      {/* 트럭/언덕 SVG 공유 크레용 필터 — 1회 렌더 */}
      <JourneyDefs />
      <main style={{ background: 'var(--bg)' }}>
        <FarmHero />

        <TruckDrive stage={1} />
        <ContentPlaceholder
          n={1}
          title="농장에서 온 원물"
          note="여기에 원물 소개가 들어갑니다. (다음 단계에서 제작)"
          tint="var(--tint-cream)"
        />

        <TruckDrive stage={2} />
        <ContentPlaceholder
          n={2}
          title="화식 + 영양 알고리즘"
          note="여기에 화식 SKU 스티키 카드 스택과 영양 알고리즘 숫자가 들어갑니다. (다음 단계에서 제작)"
          tint="var(--tint-sage)"
        />

        <TruckDrive stage={3} />
        <ContentPlaceholder
          n={3}
          title="제조 현장"
          note="여기에 제조 현장 갤러리(무한 마퀴)가 들어갑니다. (다음 단계에서 제작)"
          tint="var(--tint-cream)"
        />

        <TruckArrival />
        <JourneyCTA isAuthed={isAuthed} />
        <FaqTeaser />
      </main>
    </WebChrome>
  )
}
