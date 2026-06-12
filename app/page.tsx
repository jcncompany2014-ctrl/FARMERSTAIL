import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ChefHat,
  ClipboardCheck,
  Sprout,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import HeroSlideshow from '@/components/landing/HeroSlideshow'

/**
 * 웹 랜딩 — Farm v4 (Phase Q 피벗, 2026-06-12).
 *
 * 구조 전환: "쇼핑몰 홈" → "설문 퍼널 입구" (더파머스독/놈놈 뼈대 + 한국형 조정).
 *   - 단일 CTA: 우리 아이 플랜 보기 → (로그인) /dogs/new → 설문 / (비로그인) /signup
 *   - 가격 정책: 놈놈式 투명 — 범위·약속은 공개, 정확한 금액은 설문 결과에서
 *   - 착지: 구독 강요 없음 — 체험팩부터 (한국 "먹여보고 산다" 문화)
 *   - 커머스 레일/이벤트 캐러셀 제거. 둘러보기는 /products 링크 하나로만.
 *   - 검증 불가 숫자 ("1,200+ 보호자 · 만족도 96%") 제거 — 정직 원칙.
 *
 * 디자인 언어 (farm v4 러프 1차):
 *   - 배경: 누런 크림 대신 near-white 종이 (--bg #FAF9F5, globals.css)
 *   - 제목: serif (Noto Serif KR — 추후 마루부리 self-host 로 교체 예정)
 *   - 모서리: 넉넉한 라운드 (버튼 pill, 카드 24px) — 농장 세계관용 새 규칙.
 *     (AGENTS.md 의 v3 radius 스케일은 app 스코프 규칙이라 웹 v4 에는 미적용)
 *   - 일러스트는 추후 단계(그림체 확정 후), 음식·농장은 실사진 유지.
 */

export const revalidate = 300

export const metadata: Metadata = {
  title: '파머스테일 — 농장에서 온 우리 아이의 진짜 한 끼',
  description:
    '2분 설문이면 우리 아이 맞춤 식단과 하루 가격을 바로 확인할 수 있어요. 수의영양학 표준 설계, 제조일이 보이는 신선식. 체험팩부터 부담 없이.',
  alternates: { canonical: '/' },
  openGraph: {
    title: '파머스테일 — 농장에서 온 우리 아이의 진짜 한 끼',
    description:
      '2분 설문이면 우리 아이 맞춤 식단과 하루 가격을 바로 확인할 수 있어요. 체험팩부터 부담 없이.',
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

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span style={{ width: 18, height: 1, background: 'var(--terracotta)' }} />
      <span
        className="font-mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--terracotta)',
          fontWeight: 700,
        }}
      >
        {children}
      </span>
      <span style={{ width: 18, height: 1, background: 'var(--terracotta)' }} />
    </div>
  )
}

function PlanCTA({
  isAuthed,
  label = '우리 아이 플랜 보기',
  size = 'lg',
}: {
  isAuthed: boolean
  label?: string
  size?: 'lg' | 'md'
}) {
  return (
    <Link
      href={planHref(isAuthed)}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full font-semibold no-underline transition active:scale-[0.98] ${
        size === 'lg'
          ? 'h-[56px] md:h-[62px] px-8 md:px-10 text-[15.5px] md:text-[17px]'
          : 'h-[48px] px-7 text-[14.5px]'
      }`}
      style={{
        background: 'var(--terracotta)',
        color: '#FFFEFA',
        boxShadow: '0 2px 14px rgba(160, 69, 46, 0.22)',
      }}
    >
      {label}
      <ArrowRight size={size === 'lg' ? 19 : 16} strokeWidth={2.2} />
    </Link>
  )
}

// ---------------------------------------------------------------------------
// 1. 히어로 — 약속 한 문장 + 단일 CTA
// ---------------------------------------------------------------------------

function FarmHero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section
      className="grain grain-soft"
      style={{ position: 'relative', background: 'var(--bg)' }}
    >
      <div className="px-5 md:px-6 pt-10 md:pt-16 text-center">
        <SectionKicker>Farm to Tail · 농장에서 식탁까지</SectionKicker>

        <h1
          className="font-serif text-[30px] md:text-[56px] lg:text-[66px]"
          style={{
            margin: '14px auto 0',
            maxWidth: 760,
            lineHeight: 1.18,
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          농장에서 만든
          <br />
          우리 아이의 진짜 한 끼
        </h1>

        <p
          className="text-[14px] md:text-[17px]"
          style={{
            margin: '14px auto 0',
            maxWidth: 480,
            lineHeight: 1.65,
            color: 'var(--text)',
          }}
        >
          이름, 나이, 몸무게 — 2분 설문이면
          <br className="md:hidden" /> 우리 아이만의 식단과{' '}
          <strong style={{ color: 'var(--ink)' }}>하루 가격</strong>이 나옵니다.
        </p>

        <div className="pt-6 md:pt-8 flex flex-col items-center gap-3">
          <PlanCTA isAuthed={isAuthed} />
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 no-underline text-[13px] md:text-[14px]"
            style={{ color: 'var(--muted-strong)', fontWeight: 600 }}
          >
            우리 밥 먼저 구경하기
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>

        <p
          className="font-mono pt-5 pb-2 text-[10px] md:text-[11px]"
          style={{ letterSpacing: '0.14em', color: 'var(--muted)' }}
        >
          구독 강요 없음 · 체험팩부터 · 언제든 해지
        </p>
      </div>

      {/* 실사진 슬라이드 — 농장 → 주방 → 그릇. 일러스트는 세계관, 음식은 실사. */}
      <div className="pt-4 md:pt-6">
        <HeroSlideshow />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2. 신뢰 띠 — 검증 가능한 사실 3개만
// ---------------------------------------------------------------------------

const TRUST_ITEMS = [
  {
    icon: ClipboardCheck,
    title: '수의영양학 표준으로 설계',
    body: 'FEDIAF 기준과 RER·DER 공식으로 우리 아이의 하루 급여량을 계산해요. 감이 아니라 공식입니다.',
  },
  {
    icon: ChefHat,
    title: '만든 날이 보이는 밥',
    body: '모든 박스에 제조일과 배치 번호를 표시해요. 언제, 어떤 재료로 만들었는지 숨기지 않아요.',
  },
  {
    icon: Sprout,
    title: '사람이 먹는 등급의 재료',
    body: '농장에서 온 재료를 사람 음식 기준으로 다루고, 저온으로 천천히 조리합니다.',
  },
] as const

function TrustStrip() {
  return (
    <section className="px-5 md:px-6 py-12 md:py-20">
      <div className="grid md:grid-cols-3 gap-3 md:gap-5 max-w-[1000px] mx-auto">
        {TRUST_ITEMS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-3xl p-6 md:p-7"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--rule)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 44,
                height: 44,
                background: 'var(--bg-2)',
                color: 'var(--moss)',
              }}
            >
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <h3
              className="font-serif pt-4 text-[17px] md:text-[18px]"
              style={{ fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}
            >
              {title}
            </h3>
            <p
              className="pt-2 text-[13px] md:text-[13.5px]"
              style={{ lineHeight: 1.65, color: 'var(--muted-strong)' }}
            >
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3. 작동 방식 — 설문 → 플랜 → 체험팩 3단계
// ---------------------------------------------------------------------------

const STEPS = [
  {
    no: '1',
    title: '2분 설문',
    body: '우리 아이의 나이, 몸무게, 입맛, 건강 고민을 알려주세요. 질문은 짧고, 강아지 이름으로 불러드려요.',
  },
  {
    no: '2',
    title: '맞춤 플랜 확인',
    body: '추천 식단과 하루 급여량, 그리고 하루 가격까지 — 그 자리에서 바로 보여드려요.',
  },
  {
    no: '3',
    title: '체험팩으로 시작',
    body: '처음부터 정기배송을 권하지 않아요. 우리 아이가 잘 먹는 걸 확인한 다음에 넘어가도 늦지 않으니까요.',
  },
] as const

function HowItWorks({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section
      className="px-5 md:px-6 py-12 md:py-20"
      style={{ background: 'var(--bg-2)' }}
    >
      <div className="max-w-[1000px] mx-auto">
        <SectionKicker>How it works</SectionKicker>
        <h2
          className="font-serif text-center pt-3 text-[24px] md:text-[36px]"
          style={{ fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          시작은 이렇게 쉬워요
        </h2>

        <div className="grid md:grid-cols-3 gap-3 md:gap-5 pt-8 md:pt-12">
          {STEPS.map((s) => (
            <div
              key={s.no}
              className="rounded-3xl p-6 md:p-7"
              style={{ background: 'var(--bg)', border: '1px solid var(--rule)' }}
            >
              <span
                className="font-serif inline-flex items-center justify-center rounded-full text-[16px]"
                style={{
                  width: 36,
                  height: 36,
                  background: 'var(--terracotta)',
                  color: '#FFFEFA',
                  fontWeight: 700,
                }}
              >
                {s.no}
              </span>
              <h3
                className="pt-4 text-[16px] md:text-[17px]"
                style={{ fontWeight: 700, color: 'var(--ink)' }}
              >
                {s.title}
              </h3>
              <p
                className="pt-2 text-[13px] md:text-[13.5px]"
                style={{ lineHeight: 1.65, color: 'var(--muted-strong)' }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-8 md:pt-10">
          <PlanCTA isAuthed={isAuthed} size="md" label="2분 설문 시작하기" />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 4. 가격 약속 — 투명성 밴드
// ---------------------------------------------------------------------------

function PricePromise() {
  return (
    <section className="px-5 md:px-6 py-12 md:py-20">
      <div
        className="max-w-[860px] mx-auto rounded-3xl px-6 md:px-12 py-10 md:py-14 text-center"
        style={{ background: 'var(--ink)', color: 'var(--bg)' }}
      >
        <h2
          className="font-serif text-[22px] md:text-[32px]"
          style={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 }}
        >
          가격을 숨기지 않을게요
        </h2>
        <p
          className="pt-3 md:pt-4 text-[13.5px] md:text-[15px] mx-auto"
          style={{ maxWidth: 520, lineHeight: 1.7, color: 'rgba(250, 249, 245, 0.82)' }}
        >
          설문이 끝나면 우리 아이 기준의 <strong style={{ color: '#FFFEFA' }}>하루 가격</strong>을
          그 자리에서 보여드려요. 식단 구성과 가격표가 궁금하면 설문 없이도 언제든
          둘러볼 수 있습니다.
        </p>
        <div className="pt-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full no-underline h-[46px] px-6 text-[13.5px] font-semibold"
            style={{
              border: '1px solid rgba(250, 249, 245, 0.4)',
              color: '#FFFEFA',
            }}
          >
            식단과 가격 먼저 보기
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 5. FAQ 발췌
// ---------------------------------------------------------------------------

const FAQ_TEASERS = [
  '정기배송은 언제든 해지할 수 있나요?',
  '우리 아이가 안 먹으면 어떻게 하나요?',
  '재료는 어디에서 오나요?',
] as const

function FaqTeaser() {
  return (
    <section className="px-5 md:px-6 pb-12 md:pb-20">
      <div className="max-w-[680px] mx-auto">
        <SectionKicker>자주 묻는 질문</SectionKicker>
        <div className="pt-5 flex flex-col gap-2.5">
          {FAQ_TEASERS.map((q) => (
            <Link
              key={q}
              href="/faq"
              className="flex items-center justify-between rounded-2xl px-5 py-4 no-underline"
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--rule)',
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
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 6. 마지막 CTA
// ---------------------------------------------------------------------------

function FinalCTA({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section
      className="px-5 md:px-6 py-14 md:py-24 text-center"
      style={{ background: 'var(--bg-2)' }}
    >
      <h2
        className="font-serif text-[24px] md:text-[38px] mx-auto"
        style={{
          maxWidth: 640,
          fontWeight: 700,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}
      >
        오늘 저녁부터
        <br className="md:hidden" /> 바꿔줄 수 있어요
      </h2>
      <p
        className="pt-3 text-[13.5px] md:text-[15px]"
        style={{ color: 'var(--muted-strong)', lineHeight: 1.65 }}
      >
        2분 설문 — 우리 아이의 식단과 하루 가격을 지금 확인해 보세요.
      </p>
      <div className="pt-6 md:pt-8 flex justify-center">
        <PlanCTA isAuthed={isAuthed} />
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
    // Web/App 분리 모델 유지: 랜딩은 Web 전용 chrome. 법정 푸터(사업자 정보)는
    // WebChrome 내부 SiteFooter 가 렌더하므로 페이지 자체 푸터는 두지 않는다.
    <WebChrome cartCount={0}>
      <main style={{ background: 'var(--bg)' }}>
        <FarmHero isAuthed={isAuthed} />
        <TrustStrip />
        <HowItWorks isAuthed={isAuthed} />
        <PricePromise />
        <FaqTeaser />
        <FinalCTA isAuthed={isAuthed} />
      </main>
    </WebChrome>
  )
}
