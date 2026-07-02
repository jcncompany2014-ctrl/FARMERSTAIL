import type { Metadata } from 'next'
import {
  ArrowRight,
  Check,
  Minus,
  Leaf,
  ShieldCheck,
  Soup,
  Stethoscope,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import Reveal from '@/components/landing/Reveal'
import StickyCta from '@/components/web/fd/StickyCta'
import FdSlider from '@/components/web/fd/FdSlider'
import JsonLd from '@/components/JsonLd'
import { buildBreadcrumbJsonLd, buildFaqJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'

/**
 * 웹 /our-food — "우리 음식" (The Farmer's Dog /dog-food 실구조 복제, 2026-06-13 재구축).
 *
 * FD /dog-food 페이지는 홈과 거의 동일 구조(피처카드·비교·듀얼제품·캐러셀)지만
 * 음식 전면 강조(재료 그리드·조리). 그 깊이를 유지하며 FD 핵심 섹션 유형을 보강:
 * 히어로 → 재료 그리드 → 4 피처카드 → 저온 조리 → 완전·균형 → 2단 비교 →
 * 듀얼 제품 → 맞춤 안내 → 후기 캐러셀 → 마무리 CTA.
 * 제품/가격/SKU·레시피 노출 없음. 모든 CTA → 설문 퍼널. 사진 PhotoSlot, 가짜 후기 X.
 */

export const revalidate = 300

// R99-A 패턴: Next openGraph 는 shallow-merge 라 페이지가 images 미지정 시 layout
// 기본 OG(/api/og)를 상속 못 함 → 공유 카드 썸네일 0. 명시 OG 추가(회차160).
const OUR_FOOD_OG = ogImageUrl({
  title: '우리 음식',
  subtitle: '사람이 먹는 등급, 수비드 저온 조리 완전·균형 한 끼',
  tag: 'Our Food',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차153).
  // (이전 '우리 음식 — 파머스테일' 은 em-dash 변형이라 회차146 grep '| 파머스테일' 에 안 잡혀 잔존했음.)
  title: '우리 음식',
  description:
    '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로. 뭐가 들었는지 다 보이는 우리 아이 한 끼. 2분 설문이면 맞춤 구성을 시작해요.',
  alternates: { canonical: '/our-food' },
  openGraph: {
    title: '우리 음식 — 파머스테일',
    description:
      '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로. 뭐가 들었는지 다 보이는 우리 아이 한 끼.',
    type: 'website',
    // Next openGraph shallow-merge: 페이지가 openGraph 설정 시 layout 의
    // locale/siteName 도 상속 못 함 → 명시(회차163). 공유 카드 브랜드명·언어 정보.
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/our-food',
    images: [{ url: OUR_FOOD_OG, width: 1200, height: 630, alt: '우리 음식' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우리 음식 — 파머스테일',
    description:
      '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로.',
    images: [OUR_FOOD_OG],
  },
}

function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/start'
}

// 1. Hero ====================================================================
function FoodHero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="offwhite" pad="md" className="overflow-hidden">
      <Container size="xl">
        <div className="grid md:grid-cols-2 md:items-center gap-8 md:gap-12">
          <div className="text-center md:text-left">
            <Reveal>
              <Eyebrow>OUR FOOD</Eyebrow>
              <Display as="h1" size="xl" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
                진짜 음식은
                <br />
                이렇게 다릅니다
              </Display>
              <p className="pt-5 mx-auto md:mx-0 text-[15px] md:text-[18px]" style={{ maxWidth: 460, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
                사람이 먹을 수 있는 재료만, 수비드(저온 진공)로 천천히 조리해 그대로 담았어요.
                보존제 없이 신선하게, 뭐가 들었는지 다 보이는 한 끼.
              </p>
              <div className="pt-7 flex flex-col sm:flex-row items-center md:items-start gap-3">
                <Button href={planHref(isAuthed)} tone="coral" size="lg">
                  2분 설문 시작하기
                  <ArrowRight size={19} strokeWidth={2.4} />
                </Button>
                <Button href="/science" tone="outline" size="lg">
                  영양 설계 근거
                </Button>
              </div>
              <p className="pt-4 text-[13px]" style={{ color: 'var(--fd-muted)', fontWeight: 600 }}>
                사람이 먹는 등급 원물 · 수비드 저온 조리 · 성분 전부 공개
              </p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <PhotoSlot src="/food-bowl.jpg" alt="그릇에 담긴 신선한 화식 한 끼" label="완성된 화식 한 끼 사진" sub="그릇에 담긴 신선식 한 끼 (세로 컷 권장)" ratio="4 / 5" tone="cream" rounded={10} className="w-full" />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 2. Ingredients grid ========================================================
const INGREDIENTS = [
  { label: '닭고기 사진', sub: '담백한 단백질', tone: 'offwhite' as const },
  { label: '오리고기 사진', sub: '부드러운 단백질', tone: 'cream' as const },
  { label: '단호박 사진', sub: '천천히 타는 에너지', tone: 'green' as const },
  { label: '당근 사진', sub: '색이 살아있는 채소', tone: 'coral' as const },
  { label: '브로콜리 사진', sub: '한 끼에 더하는 초록', tone: 'pine' as const },
  { label: '현미 사진', sub: '든든한 곡물', tone: 'offwhite' as const },
]

function Ingredients() {
  return (
    <Section bg="cream" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>REAL INGREDIENTS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              사람이 먹는 등급,
              <br />
              그대로 우리 아이에게
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 460, lineHeight: 1.65, color: 'var(--fd-muted)' }}>
              정체 모를 첨가물 대신, 눈에 보이는 진짜 재료. 사람이 먹을 수 있는
              기준으로 고른 원물만 한 끼에 담아요.
            </p>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {INGREDIENTS.map((ing, i) => (
            <Reveal key={ing.label} delay={i * 70}>
              <div>
                <PhotoSlot label={ing.label} ratio="1 / 1" tone={ing.tone} rounded={8} className="w-full" />
                <p className="pt-3 text-[13.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--fd-pine)', letterSpacing: '-0.01em' }}>{ing.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// 3. Feature cards ×4 (FD 핵심) ==============================================
const FEATURES = [
  { Icon: Leaf, k: 'REAL FOOD', t: '진짜 음식', d: '눈에 보이는 신선한 원물. 정체 모를 첨가물 없이.' },
  { Icon: ShieldCheck, k: 'SAFE', t: '사람 등급 안전', d: '사람이 먹어도 되는 등급을 식품 안전 기준으로.' },
  { Icon: Soup, k: 'SOUS-VIDE', t: '수비드 저온 조리', d: '고온 압출 대신 수비드(진공 저온)로 천천히 익혀, 바로 급속 냉동.' },
  { Icon: Stethoscope, k: 'VET-DEVELOPED', t: '수의영양 설계', d: '수의영양 자문으로 영양 비율을 표준 기준에.' },
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
              <Reveal key={f.t} delay={i * 70}>
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

// 4. How it's made ===========================================================
function HowItsMade() {
  return (
    <Section bg="cream" pad="md">
      <Container size="xl">
        <div className="grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
          <Reveal>
            <PhotoSlot src="/kitchen-cooking.jpg" alt="수비드 저온으로 조리하는 주방" label="수비드 조리 / 주방 사진" sub="진공 저온으로 천천히 익히는 과정" ratio="5 / 4" tone="offwhite" rounded={10} className="w-full" />
          </Reveal>
          <Reveal delay={100}>
            <div>
              <Eyebrow>SOUS-VIDE</Eyebrow>
              <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                높은 불에 태우지 않고,
                <br />
                수비드로 천천히
              </Display>
              <p className="pt-5 text-[15px] md:text-[17px]" style={{ maxWidth: 440, lineHeight: 1.65, color: 'var(--fd-muted)' }}>
                재료가 가진 영양을 지키려면 조리 방식이 중요해요. 센 불에 빠르게
                굽는 대신, 진공 포장한 재료를 알맞은 저온에서 천천히 익히는
                수비드 방식으로 영양·수분·풍미 손실을 줄였어요.
              </p>
              <p className="pt-4 text-[15px] md:text-[17px]" style={{ maxWidth: 440, lineHeight: 1.65, color: 'var(--fd-muted)' }}>
                조리 후 신선하게 식혀 그대로 담고, 보존제는 넣지 않아요. 만든
                그대로의 한 끼가 우리 아이에게 갑니다.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 5. Complete & balanced =====================================================
const NUTRITION_POINTS = [
  { t: '완전·균형 영양', d: '필요한 영양소를 빠짐없이, 표준 기준에 맞춰.' },
  { t: '우리 아이 정량', d: '하루에 필요한 양만큼만 정확하게.' },
  { t: '수비드 저온 조리', d: '만든 그대로, 신선함을 살려 한 끼로.' },
]

function CompleteBalanced() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="lg">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 640 }}>
            <Eyebrow>COMPLETE &amp; BALANCED</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              간식이 아니라,
              <br />
              매일 먹는 완전한 한 끼
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 460, lineHeight: 1.65, color: 'var(--fd-muted)' }}>
              우리 아이가 매일 먹어도 부족함 없도록, 수의영양 기준에 맞춰 완전하고
              균형 있게 설계했어요.
            </p>
          </div>
        </Reveal>
        <div className="pt-10 md:pt-14 grid md:grid-cols-3 gap-4 md:gap-6">
          {NUTRITION_POINTS.map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div className="text-center px-4">
                <div className="mx-auto flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--fd-cream)' }}>
                  <Check size={28} strokeWidth={2.4} color="var(--fd-green)" />
                </div>
                <h3 className="pt-4 text-[17px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>{p.t}</h3>
                <p className="pt-1.5 text-[13.5px] md:text-[14px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}>{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

// 6. Comparison — 2단 (FD 핵심) ==============================================
const COMPARE_ROWS = [
  { label: '보관 방식', old: '상온 수개월 유통기한 재고', us: '주문 후 만들어 급속 냉동' },
  { label: '원료 표기', old: '‘수입산 육류’ 같은 익명', us: '농가 · 품목 · 시기 표기' },
  { label: '조리', old: '고온 압출 가공', us: '수비드 저온 조리로 영양 보존' },
  { label: '급여량', old: '한 봉지 일괄 기준', us: '우리 아이 맞춤 정량' },
]

function Comparison() {
  return (
    <Section bg="cream" pad="md">
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
          <Reveal>
            <div className="h-full" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '22px 22px' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--fd-muted)' }}>
                <Minus size={18} strokeWidth={3} />
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
          <Reveal delay={90}>
            <div className="h-full" style={{ background: 'var(--fd-pine)', borderRadius: 10, padding: '22px 22px' }}>
              <div className="flex items-center gap-2" style={{ color: 'var(--fd-coral)' }}>
                <Check size={18} strokeWidth={3} />
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

        {/* 교육 페이지 딥링크 — 비교에서 '왜 신선식인가' /why-fresh 로 (FD IA: 콘텐츠→교육) */}
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

// 7. Dual product showcase (FD 핵심) =========================================
function DualProduct({ isAuthed }: { isAuthed: boolean }) {
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
            { label: '신선 화식 레시피 사진', sub: '단백질별 메인 한 끼', k: '메인', t: '신선 화식', d: '하루 정량에 맞춘 완전·균형 한 끼.' },
            { label: '토퍼 · 간식 사진', sub: '한 끼에 더하는 토퍼', k: '플러스', t: '토퍼 · 간식', d: '입맛을 살리는 신선 토퍼와 간식을 자유롭게.' },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 90}>
              <div style={{ background: 'var(--fd-offwhite)', border: '1px solid var(--fd-line)', borderRadius: 10, overflow: 'hidden' }}>
                <PhotoSlot label={p.label} sub={p.sub} ratio="16 / 10" tone="cream" rounded={0} className="w-full" />
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

// 8. Personalized 안내 (green) ===============================================
function FoodPersonalized({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="green" pad="md">
      <Container size="md">
        <Reveal>
          <div className="text-center">
            <Eyebrow color="var(--fd-green-soft)">FOR YOUR DOG</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: '#FFFFFF' }}>
              우리 아이에게 맞는 구성은
              <br />
              설문으로 찾아드려요
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 440, lineHeight: 1.65, color: '#FFFFFF' }}>
              견종·나이·체중·활동량·민감한 음식까지. 2분 설문이면 우리 아이 몸에
              맞는 구성과 하루 정량을 계산해드려요.
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

// 9. Social proof carousel (FD 핵심, placeholder) ============================
function ReviewCard() {
  return (
    <div className="snap-start shrink-0 w-[280px] md:w-[340px]" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '24px 22px', minHeight: 208 }}>
      {/* 정직: 실제 후기 전엔 채운 별점 금지 — 윤곽선 빈 점(회차51/107/120 동일). */}
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 999, background: 'transparent', border: '1.5px solid var(--fd-line)', display: 'inline-block' }} />
        ))}
      </div>
      <div className="pt-4 flex flex-col gap-2" aria-hidden>
        <span style={{ display: 'block', height: 9, width: '94%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '88%', borderRadius: 4, background: '#EDEAE0' }} />
        <span style={{ display: 'block', height: 9, width: '72%', borderRadius: 4, background: '#EDEAE0' }} />
      </div>
      <div className="pt-5 flex items-center gap-3">
        <span style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--fd-cream)', display: 'inline-block' }} />
        <span className="text-[12.5px]" style={{ fontWeight: 700, color: 'var(--fd-muted)' }}>후기 자리 · 아이 이름</span>
      </div>
    </div>
  )
}

function SocialProof() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="xl">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
            <Eyebrow>REVIEWS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              먹어본 아이들의 변화
            </Display>
            <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 440, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
              실제 후기가 모이면 이 자리에 채워집니다.
            </p>
          </div>
        </Reveal>
        <div className="pt-9">
          <Reveal>
            <FdSlider ariaLabel="고객 후기">
              <ReviewCard />
              <ReviewCard />
              <ReviewCard />
              <ReviewCard />
              <ReviewCard />
            </FdSlider>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

// 10. Final CTA ==============================================================
// 인라인 FAQ 아코디언 (FD /our-food 패턴 — 구매 직전 이의 해소). /faq 의 native
// <details> 스타일과 일치(JS 불필요·서버 컴포넌트 호환). 정직: 효능·질병 단정 없이
// 음식·배송·보관·구독 사실만. 회차116.
const FOOD_FAQ = [
  { q: '사람이 먹는 등급이 정말 안전한가요?', a: '사람 식품과 같은 위생 기준으로 다루고, 원물은 농가·품목·시기를 표기해요. 막연한 ‘수입산 육류’ 표기와 다릅니다.' },
  { q: '입이 짧은 아이도 잘 먹을까요?', a: '신선한 화식은 기호성이 높은 편이지만 개체차가 있어요. 체험팩으로 먼저 반응을 확인해 보세요.' },
  { q: '배송과 보관은 어떻게 하나요?', a: '급속 냉동해 콜드체인으로 문 앞까지 보내요(배송비는 구독료에 포함). 받으면 냉동 보관하고, 급여 전 냉장에서 해동해 주세요.' },
  { q: '꼭 정기배송을 해야 하나요?', a: '아니요. 체험팩부터 시작할 수 있고, 배송 주기 변경·해지는 언제든 자유예요.' },
]

function FoodFaq() {
  return (
    <Section bg="offwhite" pad="md">
      <Container size="md">
        <Reveal>
          <div className="text-center mx-auto" style={{ maxWidth: 560 }}>
            <Eyebrow>FAQ</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              먹이기 전, 자주 묻는 것들
            </Display>
          </div>
        </Reveal>
        <div className="pt-8 md:pt-10 mx-auto" style={{ maxWidth: 680 }}>
          {FOOD_FAQ.map((it, i) => (
            <details
              key={it.q}
              className="group"
              style={{
                background: '#FFFFFF',
                borderLeft: '1px solid var(--fd-line)',
                borderRight: '1px solid var(--fd-line)',
                borderTop: '1px solid var(--fd-line)',
                borderBottom: i === FOOD_FAQ.length - 1 ? '1px solid var(--fd-line)' : 'none',
                padding: '18px 20px',
              }}
            >
              <summary
                className="flex items-start justify-between gap-3 cursor-pointer list-none"
                style={{ color: 'var(--fd-pine)' }}
              >
                <span className="flex-1 text-[14px] md:text-[16px]" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
                  {it.q}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 mt-0.5 transition-transform group-open:rotate-45 text-[20px] leading-none"
                  style={{ color: 'var(--fd-coral)' }}
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[13px] md:text-[14.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>
                {it.a}
              </p>
            </details>
          ))}
        </div>
        <Reveal delay={100}>
          <div className="pt-7 flex justify-center">
            <Button href="/faq" tone="outline" size="sm">
              자주 묻는 질문 더 보기
            </Button>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <Section bg="coral" pad="md">
      <Container size="md">
        <Reveal>
          <div className="text-center">
            <Display size="lg" style={{ color: '#FFFFFF' }}>
              우리 아이 한 끼,
              <br />
              오늘 시작해요
            </Display>
            <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 420, lineHeight: 1.65, color: 'rgba(255,255,255,0.92)' }}>
              체험팩부터 부담 없이. 언제든 해지.
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
export default async function OurFoodPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  // Breadcrumb 구조화 데이터 — 검색결과 "홈 › 우리 음식" 표시(회차117). faq 패턴 일치.
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '우리 음식', path: '/our-food' },
  ])

  // FAQPage 구조화데이터 — FoodFaq(가시 아코디언, 음식 특화 4문항)를 검색 FAQ
  // 리치결과 대상으로(회차138). /faq 와 다른 URL·다른 질문셋이라 별도 FAQPage 정당.
  const faqLd = buildFaqJsonLd(
    FOOD_FAQ.map((it) => ({ question: it.q, answer: it.a })),
  )

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-our-food-crumbs" data={crumbLd} />
        <JsonLd id="ld-our-food-faq" data={faqLd} />
        <FoodHero isAuthed={isAuthed} />
        <Ingredients />
        <FeatureCards />
        <HowItsMade />
        <CompleteBalanced />
        <Comparison />
        <DualProduct isAuthed={isAuthed} />
        <FoodPersonalized isAuthed={isAuthed} />
        <SocialProof />
        <FoodFaq />
        <FinalCta isAuthed={isAuthed} />
      </main>
      <StickyCta href={planHref(isAuthed)} />
    </WebChrome>
  )
}
