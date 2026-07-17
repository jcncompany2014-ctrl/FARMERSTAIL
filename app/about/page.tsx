import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import { createClient } from '@/lib/supabase/server'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import Reveal from '@/components/landing/Reveal'
import FdSlider from '@/components/web/fd/FdSlider'
import StickyCta from '@/components/web/fd/StickyCta'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'

/**
 * /about — 브랜드 이야기 (farm v6 = FD 톤 리스타일, 2026-06-13).
 * AuthAwareShell 유지(앱/웹 dispatch 불변). 콘텐츠는 기존 서사 보존, 디자인만 FD.
 * 모든 CTA → 설문 퍼널(planHref).
 */
export const revalidate = 3600

const ABOUT_OG = ogImageUrl({
  title: '브랜드 이야기',
  subtitle: '농장에서 꼬리까지, 사람이 먹는 등급의 재료로',
  tag: 'About',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명을 1회 붙이므로 페이지명만
  // (중복 '| 파머스테일' 방지, 회차147). OG/twitter 는 template 미적용=풀네임 유지.
  title: '브랜드 이야기',
  description:
    '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로. 파머스테일이 어떻게 시작되었고 무엇을 약속하는지.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: '브랜드 이야기 | 파머스테일',
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/about',
    images: [{ url: ABOUT_OG, width: 1200, height: 630, alt: '브랜드 이야기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '브랜드 이야기 | 파머스테일',
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로.',
    images: [ABOUT_OG],
  },
  robots: { index: true, follow: true },
}

function planHref(isAuthed: boolean) {
  return isAuthed ? '/dogs/new' : '/start'
}

// 실제 계약 농가·인증 확보 전까지는 구체 출처 대신 "원료를 고르는 기준"을 표기.
// (실 계약 시 '재료 → 농가·등급' 형태로 복원 — partners 페이지와 동일 정책, 2026-06)
const SOURCING = [
  { k: '육류', v: '사람이 먹는 등급을 기준으로' },
  { k: '생선', v: '출처를 밝힐 수 있는 것만' },
  { k: '채소', v: '제철 · 신선 우선' },
  { k: '곡물', v: '정제보다 통곡물 지향' },
]

const STEPS = [
  ['01', '원료 입고 · 출처 기록'],
  ['02', '저온 세척 및 수의영양 기준 계량'],
  ['03', '수비드 조리 또는 저온 동결건조'],
  ['04', '급속 냉동 후 다중 포장 · 품질 검사'],
  ['05', '2주마다 냉동 배송'],
]

const PROMISES = [
  { t: '익명 원료', b: '수입산 육류, 복합 곡물, 미상의 부산물은 쓰지 않습니다.' },
  { t: '인공 보존료', b: 'BHA · BHT · 에톡시퀸 등의 인공 산화방지제를 첨가하지 않습니다.' },
  { t: '과장 마케팅', b: '“모든 질병에 효과” 같은 문구를 쓰지 않습니다. 우리는 식단을 만듭니다.' },
  { t: '원가 절감형 부재료', b: '글루텐 밀, 값싼 대두 단백, 설탕류로 단가를 맞추지 않습니다.' },
]

export default async function AboutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '브랜드 이야기', path: '/about' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-about-crumbs" data={crumbLd} />
        {/* Hero — 미션 */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <Reveal>
              <Eyebrow>OUR STORY</Eyebrow>
              <Display as="h1" size="xl" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
                사람이 먹는 등급으로,
                <br />
                농장에서 꼬리까지
              </Display>
              <p
                className="pt-5 text-[15px] md:text-[18px]"
                style={{ maxWidth: 560, lineHeight: 1.7, color: 'var(--fd-muted)' }}
              >
                파머스테일은 “내 강아지한테 먹일 수 있는 것만 만든다”는 원칙에서
                시작했습니다. 원료의 출처, 조리 방식, 포장까지 — 반려견의 식탁을
                사람의 식탁과 같은 기준으로 다룹니다.
              </p>
              <p
                className="pt-6 text-[12px]"
                style={{ letterSpacing: '0.16em', color: 'var(--fd-green)', fontWeight: 700 }}
              >
                FARMER&rsquo;S TAIL — EST. 2026, INCHEON SONGDO
              </p>
            </Reveal>
          </Container>
        </Section>

        {/* 01 Origin */}
        <Section bg="cream">
          <Container size="xl">
            <div className="grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
              <Reveal>
                <PhotoSlot
                  src="/founder-dog.jpg" alt="설립자와 반려견" label="설립자와 반려견 / 농장 사진"
                  sub="브랜드의 시작을 보여주는 컷"
                  ratio="4 / 5"
                  tone="offwhite"
                  rounded={10}
                  className="w-full"
                />
              </Reveal>
              <Reveal delay={100}>
                <div>
                  <Eyebrow>NO.01 — ORIGIN</Eyebrow>
                  <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                    한 마리 개에게서
                    <br />
                    시작된 브랜드
                  </Display>
                  <p className="pt-4 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.75, color: 'var(--fd-muted)' }}>
                    열세 살 노견 ‘보리’의 만성 소화 문제를 해결해 보려고, 사료 대신
                    직접 만든 화식을 먹이기 시작했습니다. 수의사와의 대화, 영양소 계산,
                    재료 수급을 반복하며 알게 된 사실은 하나였습니다 —{' '}
                    <strong style={{ color: 'var(--fd-pine)' }}>
                      대부분의 반려견 식단은 ‘사람 음식 등급’으로 만들어지지 않는다.
                    </strong>
                  </p>
                  <p className="pt-3 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.75, color: 'var(--fd-muted)' }}>
                    파머스테일은 그때 세운 규칙을 그대로 따릅니다. 사람이 먹을 수 있는
                    원료만 쓰고, 출처는 농장 단위까지 추적하고, 조리 후 냉동·동결건조로
                    영양소를 붙잡습니다.
                  </p>
                </div>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 02 Farm to Tail */}
        <Section bg="white">
          <Container size="md">
            <Reveal>
              <Eyebrow>NO.02 — FARM TO TAIL</Eyebrow>
              <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                재료는 이름이 있어야 한다
              </Display>
              <p className="pt-4 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                재료의 원산지를 농장 단위까지 밝히는 것을 원칙으로 삼습니다. 익명의
                ‘수입산 육류’나 ‘복합 곡물’에 기대지 않고, 출처가 분명한 원료를 한
                곳씩 찾아가고 있어요.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="pt-7 grid gap-0" style={{ borderTop: '1px solid var(--fd-line)' }}>
                {SOURCING.map((row) => (
                  <li
                    key={row.k}
                    className="flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--fd-line)', padding: '14px 0' }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--fd-pine)' }}>{row.k}</span>
                    <span style={{ fontSize: 12.5, letterSpacing: '0.04em', color: 'var(--fd-muted)', fontWeight: 600 }}>
                      {row.v}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </Container>
        </Section>

        {/* 03 Nutrition science */}
        <Section bg="offwhite">
          <Container size="xl">
            <div className="grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
              <Reveal delay={100} className="order-2 md:order-1">
                <div>
                  <Eyebrow>NO.03 — NUTRITION SCIENCE</Eyebrow>
                  <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                    수의영양학이 만든 레시피
                  </Display>
                  <p className="pt-4 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                    모든 레시피는 <strong style={{ color: 'var(--fd-pine)' }}>AAFCO</strong> 의 성견·자견
                    영양 기준과 <strong style={{ color: 'var(--fd-pine)' }}>WSAVA</strong> 의 품질 가이드를
                    기준으로 설계합니다. ‘맛있어 보이는 음식’이 아니라 ‘영양
                    프로파일이 맞는 식단’을 만드는 곳입니다.
                  </p>
                </div>
              </Reveal>
              <Reveal className="order-1 md:order-2">
                {/* 2026-07-03 디자인 검토: 회색 placeholder → 실제 영양분석
                    리포트 이미지(랜딩과 동일 에셋). 주제(38영양소 설계) 정합. */}
                <PhotoSlot
                  label="영양 프로파일 차트"
                  src="/recipe-analysis.webp"
                  alt="파머스테일 레시피 설계 · 38가지 필수 영양소 분석 리포트"
                  sub="38가지 필수 영양소 매트릭스"
                  ratio="16 / 11"
                  tone="green"
                  rounded={10}
                  className="w-full"
                />
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 04 Kitchen */}
        <Section bg="cream">
          <Container size="md">
            <Reveal>
              <Eyebrow>NO.04 — KITCHEN</Eyebrow>
              <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                소규모 배치로, 정성껏
              </Display>
              <p className="pt-4 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                위생을 철저히 관리하는 주방에서 주 단위 소규모 배치로 조리합니다.
                완성된 식단은 급속 냉동 또는 저온 동결건조로 영양소를 포집한 뒤,
                산소·빛을 차단하는 다중 포장으로 보내드립니다.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="pt-7" style={{ borderTop: '1px solid var(--fd-line)' }}>
                {STEPS.map(([n, t]) => (
                  <li
                    key={n}
                    className="grid items-baseline"
                    style={{ gridTemplateColumns: '40px 1fr', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--fd-line)' }}
                  >
                    <span className="font-chunky" style={{ fontSize: 18, color: 'var(--fd-coral)' }}>{n}</span>
                    <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fd-pine)', fontWeight: 600 }}>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            {/* 교육 페이지 딥링크 — 주방/신선 서사에서 '왜 신선식인가' /why-fresh 로 (FD IA: 스토리→교육) */}
            <Reveal delay={160}>
              <div className="pt-8 flex justify-center">
                <Button href="/why-fresh" tone="outline" size="sm">
                  왜 신선식인지 더 알아보기
                  <ArrowRight size={15} strokeWidth={2.4} />
                </Button>
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* 05 AI nutritionist */}
        <Section bg="white">
          <Container size="xl">
            <div className="grid md:grid-cols-2 md:items-center gap-9 md:gap-14">
              <Reveal>
                {/* 2026-07-03: 회색 placeholder → 강아지 실사진(기존 에셋).
                    "내 강아지만을 위한 분석" 헤드라인과 감성 정합. */}
                <PhotoSlot
                  label="우리 아이"
                  src="/dog-portrait.jpg"
                  alt="분석을 기다리는 강아지"
                  ratio="4 / 3"
                  tone="cream"
                  rounded={10}
                  className="w-full"
                />
              </Reveal>
              <Reveal delay={100}>
                <div>
                  <Eyebrow>NO.05 — AI ANALYSIS</Eyebrow>
                  <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                    내 강아지만을 위한 분석
                  </Display>
                  <p className="pt-4 text-[14.5px] md:text-[16px]" style={{ lineHeight: 1.7, color: 'var(--fd-muted)' }}>
                    견종·체중·활동량·민감한 음식을 반영해 권장 식단과 급여량을 계산합니다.
                    단순 추천이 아니라 영양 프로파일 요약과 근거를 함께 — 주치의와 상의할
                    수 있는 수준으로 보여드려요.
                  </p>
                </div>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 06 Promises (dark) */}
        <Section bg="pine">
          <Container size="lg">
            <Reveal>
              <Eyebrow color="var(--fd-green-soft)">NO.06 — OUR PROMISES</Eyebrow>
              <Display size="lg" className="pt-3" style={{ color: '#FFFFFF' }}>
                파머스테일이 하지 않는 것
              </Display>
            </Reveal>
            <div className="pt-9 grid md:grid-cols-2 gap-3 md:gap-4">
              {PROMISES.map((row, i) => (
                <Reveal key={row.t} delay={i * 70}>
                  <div
                    className="h-full"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '20px 18px' }}
                  >
                    <span style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fd-coral)', fontWeight: 800 }}>
                      NO
                    </span>
                    <h3 className="pt-1.5 text-[17px] md:text-[19px]" style={{ fontWeight: 800, color: '#FFFFFF' }}>
                      {row.t}
                    </h3>
                    <p className="pt-2 text-[13.5px] md:text-[14px]" style={{ color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>
                      {row.b}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* 함께하는 보호자들 — 후기 캐러셀 (FD About 패턴, 정직 placeholder) */}
        <Section bg="offwhite" pad="md">
          <Container size="xl">
            <Reveal>
              <div className="text-center mx-auto" style={{ maxWidth: 600 }}>
                <Eyebrow>OUR FAMILY</Eyebrow>
                <Display size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                  함께하는 보호자들
                </Display>
                <p className="pt-4 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 440, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                  실제 후기가 모이면 이 자리에 그대로 담깁니다.
                </p>
              </div>
            </Reveal>
            <div className="pt-9">
              <Reveal>
                <FdSlider ariaLabel="보호자 후기">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="snap-start shrink-0 w-[280px] md:w-[340px]"
                      style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '24px 22px' }}
                    >
                      {/* 정직: 실제 후기 전엔 채운 별점 금지 — 윤곽선 빈 점(회차51/107/120 동일). */}
                      <div className="flex gap-1" aria-hidden>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <span key={j} style={{ width: 14, height: 14, borderRadius: 999, background: 'transparent', border: '1.5px solid var(--fd-line)', display: 'inline-block' }} />
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
                  ))}
                </FdSlider>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* Closing CTA */}
        <Section bg="coral">
          <Container size="md">
            <Reveal>
              <div className="text-center">
                <Display size="lg" style={{ color: '#FFFFFF' }}>
                  내 강아지에게 맞는
                  <br />
                  식단을 찾는 데 2분
                </Display>
                <p className="pt-4 mx-auto text-[15px] md:text-[16px]" style={{ maxWidth: 440, lineHeight: 1.65, color: 'rgba(255,255,255,0.92)' }}>
                  견종과 활동량을 알려주면, 수의영양학 기반의 맞춤 식단을 제안합니다.
                  첫 박스부터 부담 없이, 언제든 해지.
                </p>
                <div className="pt-8 flex flex-col sm:flex-row justify-center gap-3">
                  <Button href={planHref(isAuthed)} tone="cream" size="lg">
                    2분 설문 시작하기
                    <ArrowRight size={19} strokeWidth={2.4} />
                  </Button>
                  <Button href="/our-food" tone="outlineLight" size="lg">
                    우리 음식 보기
                  </Button>
                </div>
              </div>
            </Reveal>
          </Container>
        </Section>
      </main>
      <StickyCta href={planHref(isAuthed)} />
    </WebChrome>
  )
}
