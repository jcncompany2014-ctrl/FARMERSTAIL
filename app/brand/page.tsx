import type { Metadata } from 'next'
import { ArrowRight, Leaf, ShieldCheck, Sparkles, Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import StickyCta from '@/components/web/fd/StickyCta'
import JsonLd from '@/components/JsonLd'
import {
  ogImageUrl,
  buildAboutPageJsonLd,
  buildBreadcrumbJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld'
import { Button, Container, Display, Eyebrow, PhotoSlot, Section } from '@/components/web/fd/ui'
import Reveal from '@/components/landing/Reveal'
import { cred } from '@/lib/copy/credibility'

/**
 * /brand — 와이드 브랜드 스토리 (farm v6 = FD 톤, 2026-06-13).
 * 기존: chrome 없는 bare main. → WebChrome(web 전용) 래핑 + FD 톤. 콘텐츠(챕터
 * 서사·스탯·기둥)·JSON-LD 보존. CTA → 설문 퍼널 + /our-food.
 */
export const revalidate = 3600

const BRAND_OG = ogImageUrl({
  title: '농장에서 꼬리까지',
  subtitle: '사람이 먹는 등급의 재료로, 만드는 방식까지',
  tag: 'Brand',
})

export const metadata: Metadata = {
  // metadata.title 은 layout 의 template "%s | 파머스테일" 가 브랜드명을 붙이므로
  // 페이지명만 둔다(중복 '| 파머스테일' 방지, 회차146). OG/twitter 는 template
  // 미적용이라 풀네임 유지. (/about 과 title 중복도 해소 — 가시 H1 '농장에서 꼬리까지' 정합.)
  title: '농장에서 꼬리까지',
  description:
    '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
  alternates: { canonical: '/brand' },
  openGraph: {
    type: 'article',
    title: '농장에서 꼬리까지 | 파머스테일',
    description:
      '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/brand',
    images: [{ url: BRAND_OG, width: 1200, height: 630, alt: '농장에서 꼬리까지' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '농장에서 꼬리까지 | 파머스테일',
    description:
      '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    images: [BRAND_OG],
  },
  robots: { index: true, follow: true },
}

const CHAPTERS = [
  { id: 'origin', no: '01', label: '시작' },
  { id: 'pledge', no: '02', label: '약속' },
  { id: 'kitchen', no: '03', label: '주방' },
  { id: 'farm', no: '04', label: '농장' },
  { id: 'next', no: '05', label: '앞으로' },
]

const STATS: { n: string; label: string }[] = [
  { n: '100%', label: '사람 등급 재료' },
  { n: '7일', label: '주 1회 소량 생산' },
  { n: '0', label: '인공 보존료 / 향료' },
  { n: '48h', label: '조리 → 출고 콜드체인' },
]

const PILLARS = [
  // SOURCING: 아직 검증된 계약 농가가 없어 구체 수치('30여 곳')는 뺀다(감사 #55 · 사장님
  // 2026-07-22). 실제 계약 확보 시 원산지·농가 표기 카피로 복원. 원칙(출처 추적)은 사실.
  { icon: Leaf, label: 'SOURCING', title: '국내 농가에서, 직접', body: '출처가 분명한 원료를 원칙으로, 국내 농가와 직접 계약을 넓혀가고 있어요. 도축·수확에서 조리까지 짧게, 원산지가 분명한 원물만 씁니다.' },
  // RECIPE: 실 자문 없을 땐 '수의영양학 기준' 으로 톤다운(lib/copy/credibility 토글).
  { icon: ShieldCheck, label: 'RECIPE', title: cred.brandRecipeTitle, body: cred.brandRecipeBody },
  { icon: Sparkles, label: 'COOKING', title: '수비드 저온 조리', body: '72°C 수비드 저온 조리로 단백질 변성·영양 손실을 최소화. 조리 후 즉시 급속 냉동해 효소·풍미를 그대로 유지.' },
  { icon: Repeat, label: 'CARE', title: '식단 그 이후의 케어', body: '앱에서 매일 식사·체중·산책을 기록하고, 정기적으로 식단 노트를 받아요. 식단을 사고 끝나는 게 아니라 같이 사는 동안 옆에 있는 브랜드.' },
]

function Chapter({
  id,
  no,
  label,
  title,
  body,
  bg = 'offwhite',
  children,
}: {
  id: string
  no: string
  label: string
  title: string
  body?: string[]
  bg?: 'offwhite' | 'cream' | 'white'
  children?: React.ReactNode
}) {
  return (
    <Section bg={bg} id={id}>
      <Container size="lg" className="scroll-mt-32">
        <div className="md:grid md:grid-cols-[160px_1fr] md:gap-12">
          <div className="md:sticky md:top-28 self-start mb-4 md:mb-0">
            <Eyebrow>CH · {no}</Eyebrow>
            <div className="mt-1 text-[12px]" style={{ color: 'var(--fd-muted)', fontWeight: 700 }}>{label}</div>
          </div>
          <Reveal>
            <Display size="md" style={{ color: 'var(--fd-pine)' }}>{title}</Display>
            {body && (
              <div className="mt-5 md:mt-7 flex flex-col gap-4">
                {body.map((p, i) => (
                  <p key={i} className="text-[14px] md:text-[16px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.8, maxWidth: 720 }}>{p}</p>
                ))}
              </div>
            )}
            {children && <div className="mt-5 md:mt-7">{children}</div>}
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

export default async function BrandPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const planHref = user ? '/dogs/new' : '/start'

  const aboutLd = buildAboutPageJsonLd({
    name: '브랜드 이야기 — 파머스테일',
    description: '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    url: `${SITE_URL}/brand`,
  })
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '브랜드', path: '/brand' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-brand-about" data={aboutLd} />
        <JsonLd id="ld-brand-crumbs" data={crumbLd} />

        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <Eyebrow>OUR STORY · VOL.03</Eyebrow>
            <Display as="h1" size="xl" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
              농장에서
              <br />
              <span style={{ color: 'var(--fd-coral)' }}>꼬리까지.</span>
            </Display>
            <p className="pt-6 text-[15px] md:text-[18px]" style={{ color: 'var(--fd-muted)', maxWidth: 680, lineHeight: 1.7 }}>
              파머스테일은 한 마리의 늙은 보더콜리에게서 시작됐어요. 잘 안 먹는
              아이를 위해 매일 부엌에서 정성을 들였던 보호자들의 습관을, 우리는
              표준으로 옮기려 합니다.{' '}
              <strong style={{ color: 'var(--fd-pine)' }}>사람이 먹어도 되는 재료로, 사람의 식탁과 같은 기준으로.</strong>
            </p>

            {/* 챕터 인덱스 */}
            <nav aria-label="챕터" className="mt-9 grid grid-cols-3 md:grid-cols-5 gap-2.5">
              {CHAPTERS.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="no-underline transition hover:opacity-80"
                  style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '12px 14px' }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-coral)' }}>CH · {c.no}</div>
                  <div className="mt-1 text-[15px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>{c.label}</div>
                </a>
              ))}
            </nav>

            <Reveal>
              <div className="mt-10 md:mt-12">
                <PhotoSlot
                  src="/farm-to-kitchen.jpg"
                  alt="농장에서 부엌까지"
                  label="농장에서 부엌까지"
                  sub="브랜드 이미지 자리 — 실제 사진으로 교체"
                  ratio="16 / 7"
                  tone="green"
                  rounded={12}
                />
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* Ch01 Origin */}
        <Chapter
          id="origin"
          no="01"
          label="Origin"
          bg="cream"
          title="한 마리 강아지에게서 시작된"
          body={[
            '열세 살 보더콜리 ‘보리’의 만성 소화 문제로 사료에서 화식으로 식단을 갈아엎던 어느 새벽, 부엌에 도마가 일곱 개였어요. 단백질·탄수화물·지방·섬유까지 비율을 손으로 맞춰 가며 끓이고 데치고 식히는 사이, 한 가지 사실이 너무 명확해졌습니다.',
            '시중의 “반려견 식품” 중에서 사람이 먹는 등급의 재료로 만들어지는 건 손에 꼽았어요. 그래서 직접 만들기로 했습니다. 우리 아이에게 줄 수 있어야 다른 아이에게도 줄 수 있다 — 그게 첫 규칙이었어요.',
          ]}
        />

        {/* BigQuote */}
        <Section bg="offwhite" pad="sm">
          <Container size="lg">
            <Reveal>
              <blockquote
                className="text-[22px] md:text-[38px]"
                style={{ color: 'var(--fd-coral)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.25, maxWidth: 820, borderLeft: '3px solid var(--fd-coral)', paddingLeft: 20 }}
              >
                “사람이 먹는 등급의 재료로 만드는 한 끼, 그게 우리의 시작이었어요.”
              </blockquote>
            </Reveal>
          </Container>
        </Section>

        {/* Ch02 Pledge */}
        <Chapter id="pledge" no="02" label="Pledge" bg="white" title="네 가지를 절대 타협하지 않아요">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-1">
            {PILLARS.map((p, i) => {
              const Icon = p.icon
              return (
                <Reveal key={p.label} delay={i * 70}>
                  <div style={{ background: 'var(--fd-offwhite)', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '22px 20px' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: '#FFFFFF', border: '1px solid var(--fd-line)' }}>
                        <Icon className="w-5 h-5" strokeWidth={2} color="var(--fd-coral)" />
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', color: 'var(--fd-green)' }}>{p.label}</span>
                    </div>
                    <h3 className="mt-4 text-[18px] md:text-[20px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{p.title}</h3>
                    <p className="mt-2 text-[13.5px] md:text-[14.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}>{p.body}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </Chapter>

        {/* Stats (dark) */}
        <Section bg="pine" pad="md">
          <Container size="lg">
            <Eyebrow color="var(--fd-green-soft)">BY THE NUMBERS</Eyebrow>
            <Display size="md" className="pt-3" style={{ color: '#FFFFFF' }}>
              숫자가 말하는 우리의 기준
            </Display>
            <div className="mt-9 grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 80}>
                  <div style={{ borderLeft: '2px solid rgba(181,211,186,0.4)', paddingLeft: 16 }}>
                    <div style={{ fontSize: 'clamp(34px,7vw,60px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#FFFFFF' }}>{s.n}</div>
                    <div className="mt-2 text-[13px] md:text-[15px]" style={{ fontWeight: 700, color: 'var(--fd-green-soft)' }}>{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* Ch03 Kitchen */}
        <Chapter
          id="kitchen"
          no="03"
          label="Kitchen"
          bg="offwhite"
          title="작업장에 사람의 부엌과 같은 규칙을"
          body={[
            '위생을 철저히 관리하는 작업장에서, 도축·수확된 원료는 24시간 내에 손질이 시작됩니다. 72°C 수비드 저온 조리로 단백질을 익히고, 조리 직후 급속 냉동 — 이 흐름이 영양 손실을 가장 적게 두는 구간이에요.',
            '주 단위 소량 생산이라 재고가 거의 0 입니다. 무리하게 양을 쌓아 두지 않아도 일정이 돌아가도록, 정기배송과 알림이 한 시스템으로 묶여 있어요.',
          ]}
        />

        {/* Ch04 Farm */}
        <Chapter
          id="farm"
          no="04"
          label="Farm"
          bg="cream"
          title="이름 있는 재료, 이름 있는 농가"
          body={[
            '강원 평창의 한우 농가, 제주 구좌의 당근 — 우리는 “수입산 육류” 같은 익명 표기를 쓰지 않아요. 어느 농가·어느 품목·어느 시기인지를 패키지에 그대로 적습니다.',
            '재료 가격이 지나치게 변동성을 보일 때는 시세를 따라가는 게 아니라 메뉴 자체를 잠시 빼요. 좋은 재료가 들어가지 않으면 만들지 않는다 — 가장 단순한 규칙입니다.',
          ]}
        />

        {/* Ch05 Next + CTA */}
        <Chapter id="next" no="05" label="What's Next" bg="white" title="식단 그 다음의 그릇">
          <p className="text-[14px] md:text-[16px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.85, maxWidth: 720 }}>
            영양 데이터, 케어 기록, 정기 식단 노트 — 식단이 지나간 자리에 무엇이
            남는지를 우리는 기록으로 보존하려 해요. 다음 시즌에는 알레르기 케어
            라인, 노령견을 위한 라인이 차례로 추가될 예정입니다.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Button href={planHref} tone="coral" size="lg">
              2분 설문 시작하기
              <ArrowRight size={19} strokeWidth={2.4} />
            </Button>
            <Button href="/our-food" tone="outline" size="lg">
              우리 음식 보기
            </Button>
          </div>
        </Chapter>
      </main>
      <StickyCta href={planHref} />
    </WebChrome>
  )
}
