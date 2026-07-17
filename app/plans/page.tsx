import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import { ogImageUrl, buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import { Button, Container, Display, Eyebrow, PhotoSlot, Section } from '@/components/web/fd/ui'
import StickyCta from '@/components/web/fd/StickyCta'
import Reveal from '@/components/landing/Reveal'

/**
 * /plans — 정기배송 안내 (farm v6 = FD 톤, 2026-06-13).
 * FD 패턴 + 사장님 방향: **웹에 명시적 가격/할인% 노출 안 함** — 화식 비율과 혜택만
 * 안내하고 견적은 2분 설문 후 확정. PublicPageShell→WebChrome(web) 래핑.
 * 모든 CTA → 설문 퍼널(planHref). 가짜 숫자 금지.
 *
 * 2026-07-17: 옛 '주1회/2주1회/월1회' 3주기 카드를 폐기. 실제 상품은 배송 무조건
 * 2주마다(화요일) 고정이고 고객이 고르는 건 화식 비율(30/60/100)뿐이라, 웹이
 * 없는 주기를 광고해 앱 주문 화면과 어긋나던 문제를 제거. 앱 PlanClient FRESH_TIERS
 * 와 같은 라벨·비율로 맞춤.
 */
export const revalidate = 3600

const PLANS_OG = ogImageUrl({
  title: '정기배송',
  subtitle: '2주마다 냉동 배송 · 화식 비율 3단계',
  tag: 'Plans',
  variant: 'product',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차150).
  title: '정기배송',
  description:
    '2주마다 신선한 화식을 냉동 배송. 곁들임·반반·완전 화식 중 우리 아이에 맞는 비율로. 견적은 2분 설문 후 확정, 언제든 해지.',
  alternates: { canonical: '/plans' },
  openGraph: {
    title: '정기배송 | 파머스테일',
    description: '2주마다 신선한 화식을 냉동 배송. 곁들임·반반·완전 화식 중 우리 아이에 맞는 비율로.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/plans',
    images: [{ url: PLANS_OG, width: 1200, height: 630, alt: '정기배송' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '정기배송 | 파머스테일',
    description: '2주마다 신선한 화식을 냉동 배송. 곁들임·반반·완전 화식 중 우리 아이에 맞는 비율로.',
    images: [PLANS_OG],
  },
  robots: { index: true, follow: true },
}

type Plan = {
  id: string
  badge?: string
  kicker: string
  ko: string
  en: string
  cadence: string
  lede: string
  bullets: string[]
}

// 배송·결제는 무조건 2주마다 고정(화요일 발송). 고객이 고르는 건 '주기'가 아니라
// 화식 비율(30 곁들임 / 60 반반 / 100 완전) — 앱 PlanClient FRESH_TIERS 와 동일한
// 라벨·비율로 맞춰 웹/앱이 같은 정보를 준다(2026-07-17 정합).
const PLANS: Plan[] = [
  {
    id: 'light',
    badge: '추천',
    kicker: 'PLAN A',
    ko: '곁들임',
    en: 'LIGHT 30%',
    cadence: '화식 30% · 건사료 70%',
    lede: '화식이 처음이라면 여기서. 늘 먹던 사료에 화식을 더해 기호성과 영양을 함께 올려요.',
    bullets: ['익숙한 사료는 그대로, 화식만 더해요', '가장 부담 없는 첫걸음 비율', '2주마다 급여량 리뷰·조정'],
  },
  {
    id: 'half',
    kicker: 'PLAN B',
    ko: '반반',
    en: 'HALF 60%',
    cadence: '화식 60% · 건사료 40%',
    lede: '화식 반, 사료 반. 부담은 낮추고 영양 균형은 제대로 챙기는 구성이에요.',
    bullets: ['화식과 사료의 균형', '2주 단위로 급여량 리뷰·조정', '첫 회차 미개봉 시 7일 내 환불'],
  },
  {
    id: 'full',
    kicker: 'PLAN C',
    ko: '완전 화식',
    en: 'FULL 100%',
    cadence: '화식 100%',
    lede: '매일 그릇 가득 신선한 화식만. 완벽한 영양을 원하는 아이를 위한 구성이에요.',
    bullets: ['모든 끼니를 신선한 화식으로', '수의영양 기준 100% 충족', '2주마다 급여량 리뷰·조정'],
  },
]

const WHY = [
  { n: '01', t: '영양소의 일관성', b: '같은 수의영양 프로파일이 몇 주 이어질 때 장 건강·피부·체중에 의미 있는 변화가 나타납니다.' },
  { n: '02', t: '신선도', b: '주문이 확정된 만큼만 조리·냉동·출고합니다. 유통기한 기반 재고 관리와는 달라요.' },
  { n: '03', t: '합리적인 구조', b: '출고량이 예측 가능해, 같은 품질을 더 합리적으로 제공할 수 있어요.' },
  { n: '04', t: '관리의 자유', b: '언제든 건너뛰기·변경·해지 가능. 구속하지 않는 구독이 좋은 구독이라고 생각해요.' },
]

const STEPS = [
  ['01', '견종·체중·활동량·민감한 음식 입력 (2분 설문)'],
  ['02', '수의영양 기준으로 맞춤 식단·급여량 계산'],
  ['03', '화식 비율 선택 (배송은 2주마다 화요일)'],
  ['04', '2주마다 자동 출고 — 건너뛰기·변경 자유'],
]

const FAQS = [
  { q: '언제든 해지할 수 있나요?', a: '네. 발송 1주일 전까지 마이페이지에서 해지·건너뛰기·비율 변경이 가능합니다. 위약금이나 최소 약정은 없습니다.' },
  { q: '배송은 어떻게 오나요?', a: '드라이아이스 + 진공 단열재 박스로 냉동 상태를 유지해, 2주마다 화요일에 발송합니다. 수도권은 익일, 그 외 지역은 48시간 이내 도착합니다.' },
  { q: '알레르기가 있는 아이도 먹을 수 있나요?', a: '설문에서 알레르기 이력을 입력하시면, 해당 원료가 포함된 레시피는 자동으로 제외됩니다.' },
  { q: '가격은 어떻게 결정되나요?', a: '견종·체중·활동량 기반으로 1일 권장 칼로리를 계산한 뒤, 고른 화식 비율에 맞춰 견적이 산출됩니다. 2분 설문 후 정확한 금액을 확인하실 수 있어요.' },
]

function PlanCard({ plan, planHref }: { plan: Plan; planHref: string }) {
  return (
    <article style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <div style={{ background: 'var(--fd-cream)', padding: '18px 18px 16px', position: 'relative' }}>
        {plan.badge && (
          <span style={{ position: 'absolute', top: 14, right: 14, background: 'var(--fd-coral)', color: '#FFFFFF', fontSize: 10, letterSpacing: '0.08em', fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
            {plan.badge}
          </span>
        )}
        <Eyebrow>{plan.kicker}</Eyebrow>
        <div className="flex items-baseline gap-2.5 mt-2">
          <h3 style={{ fontSize: 26, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.03em', lineHeight: 1 }}>{plan.ko}</h3>
          <span style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--fd-muted)', fontWeight: 700 }}>{plan.en}</span>
        </div>
        <p className="mt-2.5" style={{ fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--fd-muted)', fontWeight: 600 }}>{plan.cadence}</p>
      </div>
      <div style={{ padding: '18px 18px 22px' }}>
        <div className="flex items-center justify-between" style={{ borderBottom: '1px solid var(--fd-line)', paddingBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fd-pine)' }}>2분 설문 후 맞춤 견적</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fd-coral-text)' }}>정기 할인</span>
        </div>
        <p className="mt-3.5 text-[13px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>{plan.lede}</p>
        <ul className="mt-3.5 grid gap-2">
          {plan.bullets.map((b) => (
            <li key={b} className="grid items-baseline" style={{ gridTemplateColumns: '14px 1fr', gap: 8, fontSize: 12.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--fd-coral)', transform: 'translateY(-2px)' }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <Button href={planHref} tone="coral" full size="md">
            이 비율로 시작
            <ArrowRight size={17} strokeWidth={2.4} />
          </Button>
        </div>
      </div>
    </article>
  )
}

export default async function PlansPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const planHref = user ? '/dogs/new' : '/start'

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '정기배송', path: '/plans' },
  ])

  // FAQPage 구조화데이터 — 페이지 하단 가시 FAQ 아코디언(FAQS 4문항: 해지·배송·
  // 알레르기·가격)을 검색 FAQ 리치결과 대상으로(회차139). /faq·/our-food 와 다른
  // URL·구독 특화 질문셋이라 별도 FAQPage 정당.
  const faqLd = buildFaqJsonLd(
    FAQS.map((it) => ({ question: it.q, answer: it.a })),
  )

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-plans-crumbs" data={crumbLd} />
        <JsonLd id="ld-plans-faq" data={faqLd} />
        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="xl">
            <div className="grid md:grid-cols-2 md:items-center gap-8 md:gap-12">
              <Reveal>
                <Eyebrow>SUBSCRIBE</Eyebrow>
                <Display as="h1" size="lg" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
                  매번 고민하지 않고,
                  <br />
                  한결같이 좋은 식단
                </Display>
                <p className="pt-5 text-[15px] md:text-[17px]" style={{ color: 'var(--fd-muted)', maxWidth: 460, lineHeight: 1.7 }}>
                  정기배송은 ‘일관된 영양’과 ‘신선도’를 동시에 잡기 위한 구조예요.
                  제품을 파는 게 아니라, 한 해 동안 이어지는 식탁을 제안합니다.
                </p>
                <div className="pt-7">
                  <Button href={planHref} tone="coral" size="lg">
                    2분 설문 시작하기
                    <ArrowRight size={19} strokeWidth={2.4} />
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={120} className="w-full">
                <PhotoSlot src="/sub-box.jpg" alt="정기배송 박스 언박싱" label="정기배송 박스 오프닝 사진" sub="냉동 패키지 언박싱" ratio="4 / 5" tone="cream" rounded={10} className="w-full" />
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* Why */}
        <Section bg="cream" pad="md">
          <Container size="lg">
            <Eyebrow>WHY SUBSCRIBE</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>왜 정기배송인가</Display>
            <div className="pt-7 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {WHY.map((r, i) => (
                <Reveal key={r.n} delay={i * 70}>
                  <div className="grid items-baseline" style={{ gridTemplateColumns: '32px 1fr', gap: 14, background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '18px 18px' }}>
                    <span className="font-chunky" style={{ fontSize: 18, color: 'var(--fd-coral)' }}>{r.n}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}>{r.t}</div>
                      <p className="mt-1 text-[13px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>{r.b}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* Cadence options */}
        <Section bg="white" pad="md">
          <Container size="xl">
            <Eyebrow>CHOOSE YOUR RATIO</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>세 가지 화식 비율</Display>
            <p className="pt-3 text-[13.5px] md:text-[15px]" style={{ color: 'var(--fd-muted)', maxWidth: 560, lineHeight: 1.6 }}>
              배송은 2주마다 한 번, 화식 비율만 우리 아이에 맞게 고르면 돼요. 2분 설문을 마치면 화면에서 맞춤 견적이 확정됩니다.
            </p>
            <div className="pt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <PlanCard plan={p} planHref={planHref} />
                </Reveal>
              ))}
            </div>
            <p className="pt-5 text-[12px]" style={{ color: 'var(--fd-muted)', letterSpacing: '0.02em', lineHeight: 1.6 }}>
              모든 비율 공통 — 2주마다 냉동 배송, 배송비 구독료 포함, 언제든 해지, 첫 회차 미개봉 시 7일 내 환불.
            </p>
          </Container>
        </Section>

        {/* How it works */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>시작은 2분, 이후는 자동으로</Display>
            <Reveal>
              <ol className="pt-6" style={{ borderTop: '1px solid var(--fd-line)' }}>
                {STEPS.map(([n, t]) => (
                <li key={n} className="grid items-baseline" style={{ gridTemplateColumns: '40px 1fr', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--fd-line)' }}>
                  <span className="font-chunky" style={{ fontSize: 18, color: 'var(--fd-coral)' }}>{n}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fd-pine)', fontWeight: 600 }}>{t}</span>
                </li>
              ))}
              </ol>
            </Reveal>
          </Container>
        </Section>

        {/* FAQ */}
        <Section bg="cream" pad="md">
          <Container size="md">
            <Eyebrow>FAQ</Eyebrow>
            <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>자주 묻는 질문</Display>
            <Reveal>
              <div className="pt-6" style={{ borderRadius: 8, overflow: 'hidden' }}>
                {FAQS.map((row, i) => (
                <details key={row.q} className="group" style={{ background: '#FFFFFF', borderLeft: '1px solid var(--fd-line)', borderRight: '1px solid var(--fd-line)', borderTop: '1px solid var(--fd-line)', borderBottom: i === FAQS.length - 1 ? '1px solid var(--fd-line)' : 'none', padding: '18px 20px' }}>
                  <summary className="flex items-start justify-between gap-3 cursor-pointer list-none" style={{ color: 'var(--fd-pine)' }}>
                    <span className="flex-1 text-[14px] md:text-[16px]" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>{row.q}</span>
                    <span aria-hidden className="shrink-0 mt-0.5 transition-transform group-open:rotate-45 text-[20px] leading-none" style={{ color: 'var(--fd-coral)' }}>+</span>
                  </summary>
                  <p className="mt-3 text-[13px] md:text-[14.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>{row.a}</p>
                </details>
                ))}
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* Closing CTA */}
        <Section bg="coral" pad="md">
          <Container size="md">
            <Reveal className="text-center">
              <Display size="md" style={{ color: '#FFFFFF' }}>
                먼저 무료 분석부터,
                <br />
                결제는 그 다음에
              </Display>
              <p className="pt-3 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 440, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
                2분 만에 끝나는 맞춤 분석이 우선이에요. 결과를 보고 화식 비율을 골라도 늦지 않아요.
              </p>
              <div className="pt-7 flex flex-col sm:flex-row justify-center gap-3">
                <Button href={planHref} tone="cream" size="lg">
                  2분 설문 시작하기
                  <ArrowRight size={19} strokeWidth={2.4} />
                </Button>
                <Button href="/about" tone="outlineLight" size="lg">
                  브랜드 이야기
                </Button>
              </div>
            </Reveal>
          </Container>
        </Section>
      </main>
      <StickyCta href={planHref} />
    </WebChrome>
  )
}
