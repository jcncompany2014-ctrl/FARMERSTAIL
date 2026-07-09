import type { Metadata } from 'next'
import {
  ArrowRight,
  Check,
  Minus,
  Leaf,
  ShieldCheck,
  Soup,
  Stethoscope,
  ClipboardList,
  Truck,
  RefreshCw,
  MessageCircle,
} from 'lucide-react'
import Link from 'next/link'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import InkStamp from '@/components/brand/InkStamp'
import Reveal from '@/components/landing/Reveal'
import StickyCta from '@/components/web/fd/StickyCta'
import { ogImageUrl } from '@/lib/seo/jsonld'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'

/**
 * 웹 홈 — farm v6 (The Farmer's Dog 충실 복제, 2026-06-13 / 재구축).
 *
 * thefarmersdog.com 실구조(리더 프록시 분석, FARMERSDOG_FIDELITY_SPEC.md)의
 * 섹션 순서·유형·인터랙션을 복제: 히어로 → 신뢰 → 가치제안 → 4 피처카드 →
 * 비교 → 건강 3단 → 듀얼 제품 → 3스텝 → 과학/근거 → 수의자문 캐러셀 →
 * 후기 캐러셀 → 마무리 CTA. 카피는 한글 신규, 사진은 PhotoSlot,
 * 모든 CTA → 설문 퍼널. 가짜 기관/언론 보증·가짜 후기·질병 단정 금지(정직 가드).
 */

export const revalidate = 300

// R99-A 패턴: Next openGraph shallow-merge 라 페이지가 images 미지정 시 layout
// 기본 OG 상속 못 함 → 공유 카드 썸네일 0. 홈 명시 OG 추가(회차161).
const HOME_OG = ogImageUrl({
  title: '사료 대신, 진짜 음식 한 끼',
  subtitle: '수의영양 기준 신선 화식 · 2분 맞춤 설문',
})

export const metadata: Metadata = {
  title: '파머스테일 — 사료 대신, 진짜 음식 한 끼',
  description:
    '사람이 먹을 수 있는 신선한 재료를 수의영양 기준에 맞춰. 2분 설문이면 우리 아이 몸에 딱 맞는 맞춤 화식을 시작할 수 있어요. 첫 박스 50% 할인으로 시작, 언제든 해지.',
  alternates: { canonical: '/' },
  openGraph: {
    title: '파머스테일 — 사료 대신, 진짜 음식 한 끼',
    description:
      '사람이 먹을 수 있는 신선한 재료를 수의영양 기준에 맞춰. 2분 설문이면 우리 아이 맞춤 화식을 시작할 수 있어요.',
    type: 'website',
    // Next openGraph shallow-merge: 페이지 openGraph 설정 시 layout 의 locale/
    // siteName 상속 못 함 → 명시(회차163). 공유 카드 브랜드명·언어 정보.
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/',
    images: [{ url: HOME_OG, width: 1200, height: 630, alt: '파머스테일' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '파머스테일 — 사료 대신, 진짜 음식 한 끼',
    description: '사람이 먹는 등급의 신선한 재료, 2분 맞춤 설문으로.',
    images: [HOME_OG],
  },
}

function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/start'
}

// 1. ========================================================================
// Hero — 풀폭 2단 + 듀얼 CTA
// ===========================================================================
function HomeHero({ isAuthed }: { isAuthed: boolean }) {
  // FD식 풀배경 사진 히어로(사장님 2026-06-15). 사진 위 하단 정렬 흰 텍스트 +
  // 코랄 CTA + 'Or give us a call' 식 작은 흰 밑줄 링크('우리 음식 보기').
  return (
    <section className="relative overflow-hidden" aria-label="히어로">
      {/* 풀배경 사진(사장님 제공). LCP 후보라 우선 로드. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-dog.jpg"
        alt="신선한 화식 한 그릇을 받는 강아지"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '50% 30%' }}
        fetchPriority="high"
      />
      {/* 텍스트 가독성 — 하단을 어둡게 하는 그라데이션 오버레이 */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(22,20,15,0.06) 0%, rgba(22,20,15,0) 28%, rgba(22,20,15,0.48) 70%, rgba(22,20,15,0.82) 100%)',
        }}
      />
      <Container size="xl">
        <div className="relative flex min-h-[76vh] md:min-h-[82vh] flex-col justify-end pt-20 pb-12 md:pb-16">
          <Reveal>
            <div className="max-w-[600px] text-center md:text-left">
              <Eyebrow color="#FFFFFF">FRESH FOOD FOR DOGS</Eyebrow>
              <Display
                as="h1"
                size="xl"
                className="pt-3"
                style={{ color: '#FFFFFF', textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}
              >
                사료 대신,
                <br />
                진짜 음식 한 끼
              </Display>
              <p
                className="pt-4 mx-auto md:mx-0 text-[15px] md:text-[18px]"
                style={{
                  maxWidth: 460,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.94)',
                  textShadow: '0 1px 10px rgba(0,0,0,0.3)',
                }}
              >
                사람이 먹을 수 있는 신선한 재료를, 수의영양 기준에 맞춰 우리 아이
                몸에 딱 맞게. 2분이면 시작해요.
              </p>
              <div className="pt-7 flex flex-col items-center md:items-start gap-4">
                <Button href={planHref(isAuthed)} tone="coral" size="lg">
                  2분 설문 시작하기
                  <ArrowRight size={19} strokeWidth={2.4} />
                </Button>
                {/* FD 'Or give us a call' 식 — 작은 흰 밑줄 텍스트 링크 */}
                <Link
                  href="/our-food"
                  className="text-[14px] font-bold underline underline-offset-[5px]"
                  style={{ color: '#FFFFFF', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
                >
                  우리 음식 보기
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}

// 2. ========================================================================
// Trust strip — 신뢰 band (가짜 로고/보증 X, 사실 태그)
// ===========================================================================
const TRUST = ['수의영양학 기준 설계', '사람이 먹는 등급 원물', '무항생제', '국내 제조 · 정직한 표시', '언제든 해지']

function TrustStrip() {
  // FD 신뢰 strip — 정적 행이 아니라 가로로 끊김없이 흐르는 마퀴(회차27).
  // globals .fv-marquee(가장자리 페이드·호버 일시정지·reduced-motion 가드 내장)
  // + 아이템 2배 복제 → -50% 이동 무한 루프. 복제본은 aria-hidden(SR 중복 방지).
  // 각 아이템 동일 marginRight → 절반 지점 seam 정확히 일치(끊김 없음).
  return (
    <div style={{ background: '#FFFFFF', borderTop: '1px solid var(--fd-line)', borderBottom: '1px solid var(--fd-line)' }}>
      <div className="fv-marquee py-4">
        <div className="fv-marquee-track" style={{ animationDuration: '22s' }}>
          {[...TRUST, ...TRUST].map((t, i) => (
            <span
              key={`${t}-${i}`}
              aria-hidden={i >= TRUST.length || undefined}
              className="inline-flex items-center gap-1.5 text-[12.5px] md:text-[13.5px] shrink-0"
              style={{ fontWeight: 700, color: 'var(--fd-muted)', letterSpacing: '-0.01em', marginRight: 40 }}
            >
              <Check size={14} strokeWidth={2.6} color="var(--fd-green)" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// 3. ========================================================================
// Value proposition — 신념 band + CTA
// ===========================================================================
function ValueProp({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="cream" pad="md">
      <Container size="md">
        <Reveal>
          <div className="text-center">
            <Eyebrow>WHY FRESH</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              제품을 파는 게 아니라,
              <br />한 끼를 책임집니다
            </Display>
            <p className="pt-5 mx-auto text-[15px] md:text-[17px]" style={{ maxWidth: 520, lineHeight: 1.7, color: 'var(--fd-muted)' }}>
              화식은 ‘일관된 영양’과 ‘신선도’를 동시에 잡는 방식이에요. 우리 아이가
              평생 먹을 음식이라면, 사람의 식탁과 같은 기준으로 만들어야 한다고
              생각했어요.
            </p>
            <div className="pt-7 flex justify-center">
              <Button href={planHref(isAuthed)} tone="coral" size="md">
                맞춤 플랜 만들기
                <ArrowRight size={18} strokeWidth={2.4} />
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 4. ========================================================================
// Feature cards ×4 — 진짜 음식 / 사람 등급 / 저온 조리 / 수의 설계
// ===========================================================================
const FEATURES = [
  { Icon: Leaf, k: 'REAL FOOD', t: '진짜 음식', d: '눈에 보이는 신선한 원물. 정체 모를 첨가물 없이, 사람이 먹는 재료 그대로.' },
  { Icon: ShieldCheck, k: 'SAFE', t: '사람 등급 안전', d: '사람이 먹어도 되는 등급의 재료를 식품 안전 기준에 맞춰 다룹니다.' },
  { Icon: Soup, k: 'SOUS-VIDE', t: '수비드 저온 조리', d: '고온 압출 대신 수비드(진공 저온)로 천천히 익혀 영양·수분·풍미를 지키고, 바로 급속 냉동해요.' },
  { Icon: Stethoscope, k: 'VET-DEVELOPED', t: '수의영양 설계', d: '수의영양 자문으로 단백질·지방·미네랄 비율을 표준 기준에 맞춰 설계.' },
]

function FeatureCards() {
  return (
    <Section bg="white" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>WHAT MAKES IT DIFFERENT</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              네 가지를 타협하지 않아요
            </Display>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.Icon
            return (
              <Reveal key={f.t} delay={i * 80}>
                <div className="h-full" style={{ background: 'var(--fd-offwhite)', border: '1px solid var(--fd-line)', borderRadius: 8, padding: 'clamp(18px,4vw,26px)' }}>
                  <span className="inline-flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, background: '#FFFFFF', border: '1px solid var(--fd-line)' }}>
                    <Icon size={24} strokeWidth={2} color="var(--fd-coral)" />
                  </span>
                  <div className="pt-4 text-[10px]" style={{ fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)' }}>{f.k}</div>
                  <h3 className="pt-1.5 text-[16px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{f.t}</h3>
                  <p className="pt-2 text-[12.5px] md:text-[13.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}>{f.d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

// 5. ========================================================================
// Comparison — 2단 대비(그동안의 사료 vs 파머스테일). 정직: 카테고리 사실 대비.
// ===========================================================================
const COMPARE_ROWS = [
  { label: '보관 방식', old: '상온 수개월 유통기한 재고', us: '주문 후 만들어 급속 냉동' },
  { label: '원료 표기', old: '‘수입산 육류’ 같은 익명', us: '농가 · 품목 · 시기 표기' },
  { label: '조리', old: '고온 압출 가공', us: '수비드 저온 조리로 영양 보존' },
  { label: '급여량', old: '한 봉지 일괄 기준', us: '우리 아이 맞춤 정량' },
]

function Comparison() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="lg">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 560 }}>
            <Eyebrow>THE DIFFERENCE</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              그동안의 사료와는
              <br />다르게 만듭니다
            </Display>
          </div>
        </Reveal>
        <div className="pt-9 md:pt-12 grid md:grid-cols-2 gap-3 md:gap-4">
          {/* 그동안의 사료 */}
          <Reveal>
            <div className="h-full" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '22px 22px' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--fd-muted)' }}>
                <Minus size={18} strokeWidth={3} aria-hidden />
                <span className="text-[13px]" style={{ fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>그동안의 사료</span>
              </div>
              <ul className="pt-4 grid gap-3">
                {COMPARE_ROWS.map((r) => (
                  <li key={r.label} className="grid items-baseline" style={{ gridTemplateColumns: '76px 1fr', gap: 10 }}>
                    <span className="text-[11.5px]" style={{ fontWeight: 700, color: 'var(--fd-muted)', opacity: 0.8 }}>{r.label}</span>
                    <span className="text-[13.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.5 }}>{r.old}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          {/* 파머스테일 */}
          <Reveal delay={90}>
            <div className="h-full" style={{ background: 'var(--fd-pine)', borderRadius: 10, padding: '22px 22px' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--fd-coral)' }}>
                <Check size={18} strokeWidth={3} aria-hidden />
                <span className="text-[13px]" style={{ fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>파머스테일</span>
              </div>
              <ul className="pt-4 grid gap-3">
                {COMPARE_ROWS.map((r) => (
                  <li key={r.label} className="grid items-baseline" style={{ gridTemplateColumns: '76px 1fr', gap: 10 }}>
                    <span className="text-[11.5px]" style={{ fontWeight: 700, color: 'var(--fd-green-soft)' }}>{r.label}</span>
                    <span className="text-[13.5px]" style={{ color: '#FFFFFF', fontWeight: 600, lineHeight: 1.5 }}>{r.us}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* 교육 페이지 딥링크 — 비교에서 '왜 신선식인가' /why-fresh 로 (FD IA: 홈→교육) */}
        <Reveal delay={120}>
          <div className="pt-8 flex justify-center">
            <Button href="/why-fresh" tone="outline" size="sm">
              왜 신선식인지 더 알아보기
              <ArrowRight size={15} strokeWidth={2.4} />
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 6. ========================================================================
// How we make it healthy — 3단
// ===========================================================================
const MAKE = [
  { Icon: ShieldCheck, t: '사람 등급 기준', d: '사람이 먹는 등급의 재료를, 사람 식품과 같은 위생 기준으로 다룹니다.' },
  { Icon: ClipboardList, t: '우리 아이 맞춤', d: '견종·체중·활동량·민감한 음식을 반영해 식단과 정량을 계산해요.' },
  { Icon: Truck, t: '며칠 내 신선 배송', d: '주문이 확정된 만큼만 조리·냉동해 콜드체인으로 문 앞까지.' },
]

function HowWeMakeIt() {
  return (
    <Section bg="cream" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>OUR PROCESS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              건강한 한 끼는 이렇게 만들어져요
            </Display>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid md:grid-cols-3 gap-4 md:gap-6">
          {MAKE.map((m, i) => {
            const Icon = m.Icon
            return (
              <Reveal key={m.t} delay={i * 80}>
                <div className="text-center px-4">
                  <div className="mx-auto flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, background: '#FFFFFF', border: '1px solid var(--fd-line)' }}>
                    <Icon size={28} strokeWidth={2} color="var(--fd-green)" />
                  </div>
                  <h3 className="pt-4 text-[17px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>{m.t}</h3>
                  <p className="pt-1.5 text-[13.5px] md:text-[14px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}>{m.d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

// 7. ========================================================================
// Complete meal plan — 듀얼 제품 쇼케이스
// ===========================================================================
function CompleteMealPlan({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="white" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>A COMPLETE BOWL</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              한 그릇을 완성하는 구성
            </Display>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid md:grid-cols-2 gap-4 md:gap-6">
          {[
            { label: '신선 화식 레시피 사진', sub: '단백질별 메인 한 끼', k: '메인', t: '신선 화식', d: '하루 정량에 맞춘 완전·균형 한 끼.', img: '/meal-recipe.webp', alt: '파머스테일 블랙포크 레시피 화식 파우치' },
            { label: '영양제 소스 사진', sub: '한 끼에 더하는 영양 소스', k: '플러스', t: '영양제 소스', d: '하루 한 캡슐, 목적별 영양을 한 끼에 더하는 데일리 소스.', img: '/supplement-box.webp', alt: '파머스테일 영양제 패키지' },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div style={{ background: 'var(--fd-offwhite)', border: '1px solid var(--fd-line)', borderRadius: 10, overflow: 'hidden' }}>
                <PhotoSlot label={p.label} sub={p.sub} src={p.img} alt={p.alt} ratio="16 / 10" tone="cream" rounded={0} className="w-full" />
                <div style={{ padding: '20px 22px' }}>
                  <div className="text-[10px]" style={{ fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)' }}>{p.k}</div>
                  <h3 className="pt-1.5 text-[18px] md:text-[20px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{p.t}</h3>
                  <p className="pt-2 text-[13.5px] md:text-[14.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>{p.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="pt-9 flex justify-center">
            <Button href={planHref(isAuthed)} tone="coral" size="lg">
              우리 아이 구성 보기
              <ArrowRight size={19} strokeWidth={2.4} />
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 7.5 ======================================================================
// Plan benefits — 서비스/배송 혜택 4아이콘 (FD #9, FIDELITY_SPEC §8 보강).
// 커머스 거래 아님: 배송포함·콜드체인·유연성·문의지원 = 사실 기반 신뢰/서비스
// 메시지(프로모바와 일치). 가짜 숫자·미검증 친환경 주장 없음.
// ===========================================================================
const BENEFITS = [
  { Icon: Truck, t: '배송 포함', d: '배송비는 구독료에 포함, 추가 비용 없어요.' },
  { Icon: Leaf, t: '콜드체인 신선', d: '급속 냉동해 신선함 그대로 문 앞까지.' },
  { Icon: RefreshCw, t: '약정 없음', d: '첫 박스부터 부담 없이. 주기 변경·해지는 언제든 자유.' },
  { Icon: MessageCircle, t: '1:1 문의 지원', d: '궁금한 점은 언제든 답해 드려요.' },
]

function PlanBenefits() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 560 }}>
            <Eyebrow>WHY IT&rsquo;S EASY</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              시작도, 이어가기도 쉽게
            </Display>
          </div>
        </Reveal>
        <div className="pt-9 md:pt-12 grid grid-cols-2 lg:grid-cols-4 gap-7 md:gap-8">
          {BENEFITS.map((b, i) => {
            const Icon = b.Icon
            return (
              <Reveal key={b.t} delay={i * 80}>
                <div className="text-center">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: 54, height: 54, borderRadius: 999, background: '#FFFFFF', border: '1px solid var(--fd-line)' }}
                  >
                    <Icon size={24} strokeWidth={2} color="var(--fd-green)" />
                  </span>
                  <h3 className="pt-4 text-[16px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{b.t}</h3>
                  <p className="pt-2 text-[12.5px] md:text-[13.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.55, maxWidth: 220, marginLeft: 'auto', marginRight: 'auto' }}>{b.d}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}

// 8. ========================================================================
// How it works — 3스텝 (다크)
// ===========================================================================
const STEPS = [
  { n: '01', t: '우리 아이 알려주기', d: '2분 설문으로 견종·나이·체중·활동량·민감한 음식을 알려주세요.' },
  { n: '02', t: '맞춤 조리 · 배송', d: '수의영양 기준에 맞춰 신선하게 만들고 정량 포장해 문 앞까지.' },
  { n: '03', t: '더 건강한 하루', d: '잘 먹고, 잘 싸고, 컨디션 좋은 매일. 잘 맞으면 정기배송으로.' },
]

function HowItWorks({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="pine" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center">
            <Eyebrow color="var(--fd-green-soft)">HOW IT WORKS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: '#FFFFFF' }}>
              3단계면 시작이에요
            </Display>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-16 grid md:grid-cols-3 gap-8 md:gap-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <div className="text-center md:text-left">
                <span className="font-chunky" style={{ fontSize: 'clamp(40px, 9vw, 58px)', color: 'var(--fd-coral)', lineHeight: 1 }}>{s.n}</span>
                <h3 className="pt-3 text-[19px] md:text-[21px]" style={{ fontWeight: 800, color: '#FFFFFF' }}>{s.t}</h3>
                <p className="pt-2 text-[14px] md:text-[15px]" style={{ color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="pt-11 md:pt-14 flex justify-center">
            <Button href={planHref(isAuthed)} tone="coral" size="lg">
              2분 설문 시작하기
              <ArrowRight size={19} strokeWidth={2.4} />
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 9. ========================================================================
// Science & expertise — 불릿 + /science
// ===========================================================================
const SCIENCE = [
  '수의영양학 표준 기준에 맞춘 영양 설계',
  '단백질·지방·미네랄·미량영양소 비율 균형',
  '견종·나이·체중·활동량 반영한 1일 권장 칼로리',
  '근거가 되는 가이드라인을 공개 — 슬로건이 아니라 출처로',
]

function ScienceExpertise() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="xl">
        <div className="grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
          <Reveal>
            <div>
              <Eyebrow>THE SCIENCE</Eyebrow>
              <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                마케팅이 아니라
                <br />수의영양학으로
              </Display>
              <ul className="pt-6 grid gap-3">
                {SCIENCE.map((s) => (
                  <li key={s} className="grid items-baseline" style={{ gridTemplateColumns: '20px 1fr', gap: 10 }}>
                    <Check size={17} strokeWidth={3} color="var(--fd-coral)" />
                    <span className="text-[14px] md:text-[15px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>{s}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-7">
                <Button href="/science" tone="pine" size="md">
                  영양 설계 근거 보기
                  <ArrowRight size={18} strokeWidth={2.4} />
                </Button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <PhotoSlot src="/recipe-analysis.webp" alt="식품 정보 분석 보고서 — 레시피 설계·영양 분석" label="레시피 설계 / 영양 분석" ratio="1600 / 764" tone="green" rounded={10} className="w-full" />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 10. =======================================================================
// Vet voices — 수의 자문 캐러셀 (placeholder, 가짜 인용 X)
// ===========================================================================
// 가짜 전문가 자문 카드(QuoteCard) 제거 — 표시광고법(미검증 전문가 보증 금지).
// VetVoices 는 자사 영양 설계 원칙(실사실)으로 대체. 실 자문 확보 시 별도 섹션.

function VetVoices() {
  return (
    <Section bg="pine" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow color="var(--fd-green-soft)">OUR STANDARD · 영양 설계</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: '#FFFFFF' }}>
              표준에 맞춰, 빠짐없이
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 480, color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>
              미국 AAFCO · 유럽 FEDIAF · 국내 NIAS, 세 영양 표준을 동시에 충족하도록 설계했어요.
            </p>
          </div>
        </Reveal>
        <div className="pt-9">
          <Reveal>
            <ul className="grid gap-3 md:grid-cols-2 mx-auto" style={{ maxWidth: 720 }}>
              {[
                '세 영양 표준 중 가장 엄격한 기준을 채택하고, +15% 안전 마진을 더했어요.',
                '단백질·지방·미네랄 비율을 표준에 맞춰 균형 있게 구성했어요.',
                '심장 등 자연 원물에서 타우린을, 연어유에서 오메가-3를 공급해요.',
                '급여 전환은 7~10일에 걸쳐 천천히 — 아이의 변 상태를 보며 조절하길 권장해요.',
              ].map((t) => (
                <li key={t} className="rounded-[12px] px-5 py-4 text-left" style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}>
                  <span className="text-[14px]" style={{ lineHeight: 1.6, color: '#FFFFFF' }}>{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 10b. ======================================================================
// Study / 근거 — "기대 변화" 4콜아웃 (FD Study 섹션 대응). 정직: 가이드라인 근거 ·
// 생활개선 표현(질병 치료/효능 단정 금지) · 가짜 수치 없음 · /science 링크.
// ===========================================================================
const EVIDENCE = [
  { n: '01', t: '소화 · 변 상태', d: '소화가 잘 되는 재료와 균형으로 매일의 컨디션을 살펴요.' },
  { n: '02', t: '피부 · 모질', d: '단백질·필수지방산 균형으로 윤기와 피부 컨디션을 챙겨요.' },
  { n: '03', t: '활력 · 하루 컨디션', d: '필요 칼로리에 맞춘 급여로 하루 활력을 지켜요.' },
  { n: '04', t: '적정 체중', d: '몸에 맞춘 정량 급여로 적정 체중 관리를 도와요.' },
]

function Evidence() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="lg">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 620 }}>
            <Eyebrow>WHY IT MATTERS</Eyebrow>
            <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              꾸준한 균형 식단이
              <br className="hidden md:block" /> 만드는 변화
            </Display>
            <p className="pt-4 text-[14px] md:text-[15px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>
              매 끼니 같은 수의영양 기준으로 균형 잡힌 신선식을 이어갈 때, 보호자분들이
              일상에서 살펴볼 수 있는 부분이에요. 개체차가 있으며 치료 효과를 보장하지는
              않아요.
            </p>
          </div>
        </Reveal>

        <div className="pt-8 md:pt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {EVIDENCE.map((it, i) => (
            <Reveal key={it.n} delay={i * 80}>
              <div
                style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '20px 18px', height: '100%' }}
              >
                <span className="font-chunky" style={{ fontSize: 18, color: 'var(--fd-coral)' }}>{it.n}</span>
                <div className="mt-2.5 text-[15px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}>{it.t}</div>
                <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="pt-7 md:pt-9 text-center">
            <Link
              href="/science"
              className="inline-flex items-center gap-1.5 no-underline text-[13.5px]"
              style={{ color: 'var(--fd-coral-text)', fontWeight: 700 }}
            >
              영양 설계 근거 보기
              <ArrowRight size={15} strokeWidth={2.4} />
            </Link>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// 11. =======================================================================
// Social proof — 고객 후기 캐러셀 (placeholder, 가짜 후기 X)
// ===========================================================================
// 가짜 후기 카드(ReviewCard) 제거 — 표시광고법(허위 후기 금지).
// SocialProof 는 "후기 준비중" 정직 placeholder 로 대체. 실 후기 도착 시 교체.

function SocialProof() {
  return (
    <Section bg="cream" pad="md" className="relative overflow-hidden">
      {/* de-AI 워터마크 — 검수 도장을 크게·아주 옅게 뒤에 깔아 '봉인' 느낌.
          right 음수 오프셋은 Section overflow-hidden 이 클리핑(가로 스크롤 방지),
          모바일 hidden. 장식이라 InkStamp label 미지정 → aria-hidden. */}
      <InkStamp
        lines={['파머스테일 주방', '직접 조리 · 검수']}
        sub="SINCE 2026"
        size={300}
        color="var(--stamp)"
        className="pointer-events-none absolute right-[-48px] top-1/2 hidden sm:block"
        style={{ transform: 'translateY(-50%) rotate(-8deg)', opacity: 0.06, zIndex: 0 }}
      />
      <Container size="xl" className="relative z-[1]">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>REVIEWS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              보호자도, 아이도 좋아해요
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 440, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
              출시 후, 신선식으로 한 끼를 바꾼 보호자들의 진짜 이야기를 이곳에 담을게요.
            </p>
          </div>
        </Reveal>
        <div className="pt-9">
          <Reveal>
            <div className="rounded-[12px] mx-auto text-center" style={{ maxWidth: 520, background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)', padding: '28px 24px' }}>
              <p className="text-[14px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}>
                아직 후기를 모으는 중이에요. 첫 보호자들의 솔직한 후기가 도착하면
                이곳에서 그대로 보여드릴게요.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 12. =======================================================================
// Final CTA
// ===========================================================================
function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="coral" pad="md">
      <Container size="md">
        <Reveal>
          <div className="text-center">
            <Display size="lg" style={{ color: '#FFFFFF' }}>
              우리 아이의 진짜 한 끼,
              <br />
              오늘 시작해요
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 420, lineHeight: 1.65, color: 'rgba(255,255,255,0.92)' }}>
              첫 박스 50% 할인, 부담 없이. 언제든 해지.
            </p>
            <div className="pt-8 flex justify-center">
              <Button href={planHref(isAuthed)} tone="cream" size="lg">
                2분 설문 시작하기
                <ArrowRight size={19} strokeWidth={2.4} />
              </Button>
            </div>
            <p className="pt-5 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              수의영양학 기반 · 무항생제 원물 · 구독 강요 없음
            </p>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

// ===========================================================================
// Page — FD 실구조 순서
// ===========================================================================
export default async function LandingPage() {
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  const isAuthed = !!user

  return (
    <WebChrome>
      <main>
        <HomeHero isAuthed={isAuthed} />
        <TrustStrip />
        <ValueProp isAuthed={isAuthed} />
        <FeatureCards />
        <Comparison />
        <HowWeMakeIt />
        <CompleteMealPlan isAuthed={isAuthed} />
        <PlanBenefits />
        <HowItWorks isAuthed={isAuthed} />
        <ScienceExpertise />
        <VetVoices />
        <Evidence />
        <SocialProof />
        <FinalCta isAuthed={isAuthed} />
      </main>
      <StickyCta href={planHref(isAuthed)} />
    </WebChrome>
  )
}
