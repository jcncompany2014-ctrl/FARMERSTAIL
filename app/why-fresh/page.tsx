import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { ogImageUrl, buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import { createClient } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import StickyCta from '@/components/web/fd/StickyCta'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  PhotoSlot,
  Section,
} from '@/components/web/fd/ui'
import Reveal from '@/components/landing/Reveal'

/**
 * /why-fresh — "왜 신선한 화식인가" 교육 페이지 (FD /why-fresh 대응, 회차195~).
 *
 * FD sitemap 대조(회차193)에서 발견한 미복제 페이지. FD 상단 nav 교육 기둥.
 * 수비드 신선식 vs 고온·고압 가공 건사료를 **사실 기반**으로 비교 교육.
 * 질병 단정·치료효과·가짜 수치 금지(정직성 가드). 모든 CTA → 설문 퍼널(planHref).
 *
 * Phase 1(이 회차): 라우트 골격 + 메타/OG/JsonLd + 히어로 + 마무리 CTA.
 * Phase 2(다음): 본문 교육 섹션(가공방식 비교/원물 등급/소화 framing).
 * Phase 3: WebChrome 상단 nav 링크 추가(=.next clear) + sitemap 노출.
 */
export const revalidate = 3600

const WHYFRESH_OG = ogImageUrl({
  title: '왜 신선한 화식인가',
  subtitle: '고온 가공 사료가 아니라, 수비드 신선식',
  tag: 'Why Fresh',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // 루트 layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지).
  title: '왜 신선한 화식인가',
  description:
    '수비드로 조리한 신선식과 고온·고압으로 가공한 건사료는 출발부터 다릅니다. 재료 등급·만드는 방식·그릇에 담기는 모습까지, 무엇이 어떻게 다른지 솔직하게.',
  alternates: { canonical: '/why-fresh' },
  openGraph: {
    title: '왜 신선한 화식인가 | 파머스테일',
    description:
      '수비드 신선식 vs 고온·고압 가공 건사료 — 재료 등급·가공 방식·소화의 차이를 사실 그대로.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/why-fresh',
    images: [
      { url: WHYFRESH_OG, width: 1200, height: 630, alt: '왜 신선한 화식인가' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '왜 신선한 화식인가 | 파머스테일',
    description:
      '수비드 신선식 vs 고온·고압 가공 건사료 — 재료·가공·소화의 차이를 사실 그대로.',
    images: [WHYFRESH_OG],
  },
  robots: { index: true, follow: true },
}

// /why-fresh 전용 정직 FAQ — '왜 신선식' 맥락(전환/보관/알레르기/가격). 효능·
// 질병 단정 금지, 가짜 수치 0, 레시피 노출 0, 단정 대신 '수의사 상담' 톤(회차202).
const WHYFRESH_FAQ = [
  {
    q: '화식은 건사료보다 영양이 부족하지 않나요?',
    a: '신선식도 하루에 필요한 영양 기준을 충족하도록 균형을 맞춰 설계해요. 재료가 신선할 뿐, 영양이 빠지는 게 아니에요.',
  },
  {
    q: '기존 사료에서 어떻게 바꾸나요?',
    a: '한 번에 바꾸기보다 일주일에서 열흘 정도에 걸쳐 기존 사료에 조금씩 섞어가며 늘리는 걸 권해요. 아이마다 속도가 다르니 천천히요.',
  },
  {
    q: '바꾸면 배탈이 나지 않을까요?',
    a: '급하게 바꾸면 일시적으로 변이 묽어질 수 있어, 천천히 섞어주는 게 좋아요. 평소와 다른 증상이 계속되면 수의사와 상담하세요.',
  },
  {
    q: '알레르기가 있는 아이도 먹을 수 있나요?',
    a: '들어간 원물을 투명하게 표기해, 피해야 할 재료를 고르기 쉬워요. 다만 알레르기 진단과 식이 관리는 수의사와 함께 정하는 걸 권해요.',
  },
  {
    q: '신선식은 더 비싸지 않나요?',
    a: '재료와 보관 방식이 다르다 보니 일반 건사료보다 부담이 될 수 있어요. 그래서 화식 비율(곁들임·반반·완전)을 골라 부담을 조절할 수 있게 했고, 구독 할인도 기본으로 들어가요. 언제든 해지할 수 있어요.',
  },
]

export default async function WhyFreshPage() {
  // 모든 CTA → 설문 퍼널: 로그인 시 /dogs/new, 비로그인 /signup (전 마케팅 페이지 동일).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const planHref = user ? '/dogs/new' : '/start'

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '왜 신선식', path: '/why-fresh' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-whyfresh-crumbs" data={crumbLd} />
        <JsonLd
          id="ld-whyfresh-faq"
          data={buildFaqJsonLd(
            WHYFRESH_FAQ.map((f) => ({ question: f.q, answer: f.a })),
          )}
        />

        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container>
            <div className="grid items-center gap-8 md:gap-12 md:grid-cols-2">
              <Reveal>
                <Eyebrow>Why Fresh</Eyebrow>
                <Display as="h1" size="xl">
                  사료가 아니라,
                  <br />
                  진짜 음식인 이유
                </Display>
                <p
                  className="mt-5 max-w-[46ch] text-[clamp(15px,1.8vw,18px)] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  수비드로 조리한 신선식과 고온·고압으로 가공한 건사료는 출발부터
                  다릅니다. 재료의 등급, 만드는 방식, 그리고 그릇에 담기는 마지막
                  모습까지 — 무엇이 어떻게 다른지 솔직하게 보여드릴게요.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button href={planHref} size="lg">
                    2분 설문으로 시작하기
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </Button>
                  <Button href="/our-food" tone="outline" size="lg">
                    우리 음식 보기
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={120}>
                <PhotoSlot
                  src="/fresh-bowl.jpg"
                  alt="수비드 저온 조리 신선식 한 그릇"
                  label="신선식 한 그릇"
                  sub="수비드 저온 조리 화식 클로즈업"
                  ratio="4 / 3"
                />
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 비교: 저온 조리 화식 vs 고온·고압 가공 사료 — 사실 기반(질병 단정·레시피 노출 금지) */}
        <Section bg="offwhite" pad="md">
          <Container>
            <Reveal>
              <div className="mx-auto max-w-[640px] text-center">
                <Eyebrow>Fresh vs Kibble</Eyebrow>
                <Display as="h2" size="lg" className="mx-auto mt-3 max-w-[18ch]" style={{ color: 'var(--fd-pine)' }}>
                  무엇이 다른가요?
                </Display>
                <p
                  className="mx-auto mt-4 max-w-[40ch] text-[clamp(14px,1.7vw,17px)] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  건강 효과를 단정하진 않을게요. 다만 &lsquo;어떻게 만들어지고
                  무엇이 들어가는가&rsquo;는 분명히 다릅니다.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Reveal delay={80}>
                <div
                  className="h-full rounded-[16px] p-7"
                  style={{ background: 'var(--fd-pine)' }}
                >
                  <span
                    className="text-[12px] font-extrabold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--fd-green-soft)' }}
                  >
                    신선 화식
                  </span>
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {[
                      '사람이 먹을 수 있는 신선한 재료',
                      '수비드로 부드럽게 조리',
                      '수분을 머금은 촉촉한 상태',
                      '냉동·냉장으로 보관',
                      '만든 그대로, 최소한의 가공',
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex items-start gap-2.5 text-[15px] leading-relaxed"
                        style={{ color: 'var(--fd-offwhite)' }}
                      >
                        <span
                          className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--fd-coral)' }}
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal delay={160}>
                <div
                  className="h-full rounded-[16px] p-7"
                  style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)' }}
                >
                  <span
                    className="text-[12px] font-extrabold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--fd-muted)' }}
                  >
                    일반 건사료
                  </span>
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {[
                      '건조·분말화한 원료가 중심',
                      '고온·고압으로 압출 성형',
                      '수분을 날린 바삭한 건조 형태',
                      '실온에서 장기 보관',
                      '보존·기호 첨가가 흔함',
                    ].map((t) => (
                      <li
                        key={t}
                        className="flex items-start gap-2.5 text-[15px] leading-relaxed"
                        style={{ color: 'var(--fd-pine)' }}
                      >
                        <span
                          className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--fd-line)' }}
                        />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 원물 등급 — 사람이 먹는 등급 (사실 기반·레시피 노출 금지) */}
        <Section bg="offwhite" pad="md">
          <Container>
            <div className="grid items-center gap-8 md:gap-12 md:grid-cols-2">
              <Reveal>
                <Eyebrow>Real Ingredients</Eyebrow>
                <Display as="h2" size="lg" className="mt-3 max-w-[18ch]" style={{ color: 'var(--fd-pine)' }}>
                  사람이 먹는 등급, 그대로
                </Display>
                <p
                  className="mt-4 max-w-[44ch] text-[clamp(14px,1.7vw,17px)] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  특별한 재료가 아니에요. 우리가 먹을 수 있는 신선한 정육·채소를,
                  같은 기준으로 골라 손질하고 조리할 뿐입니다.
                </p>
                <ul className="mt-7 flex flex-col gap-4">
                  {[
                    '사람이 먹을 수 있는 등급의 정육·채소',
                    '신선한 상태로 손질해 수비드로 조리',
                    '어떤 원물이 들어가는지 솔직하게 안내',
                  ].map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-3 text-[clamp(15px,1.6vw,18px)] leading-relaxed"
                      style={{ color: 'var(--fd-pine)' }}
                    >
                      <span
                        className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: 'var(--fd-coral)' }}
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={120}>
                <PhotoSlot
                  src="/raw-ingredients.jpg"
                  alt="손질 전 신선한 원물 재료"
                  label="원물 사진"
                  sub="손질 전 신선 재료"
                  ratio="4 / 3"
                  className="w-full"
                />
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 촉촉함·향·식감 — 신선식이 다르게 느껴지는 이유 (물성 사실만·질병/소화 효능 단정 금지) */}
        <Section bg="pine" pad="md">
          <Container>
            <Reveal>
              <div className="mx-auto max-w-[640px] text-center">
                <Eyebrow color="var(--fd-green-soft)">Moisture &amp; Texture</Eyebrow>
                <Display as="h2" size="lg" className="mt-3" style={{ color: '#FFFFFF' }}>
                  촉촉하게, 맛있게
                </Display>
                <p
                  className="mx-auto mt-4 max-w-[40ch] text-[clamp(14px,1.7vw,17px)] leading-relaxed"
                  style={{ color: 'rgba(247,245,240,0.82)' }}
                >
                  왜 신선식은 다르게 느껴질까요? 비밀은 거창하지 않아요 — 수분,
                  향, 그리고 결이에요. 효능을 단정하진 않을게요. 다만 그릇에 담기는
                  마지막 모습은 분명히 다릅니다.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {[
                {
                  label: '수분을 머금은 한 끼',
                  body: '수비드로 조리해 재료의 수분을 그대로 지킵니다. 바삭하게 말린 건사료와는 다른, 촉촉한 질감이에요.',
                },
                {
                  label: '향과 식감이 살아 있어요',
                  body: '사람이 먹는 재료를 그대로 익혀, 재료 본연의 향과 식감을 지킵니다.',
                },
                {
                  label: '부드럽게, 한 입씩',
                  body: '갈아 굳힌 알갱이가 아니라, 결이 살아 있는 부드러운 음식 그대로 담습니다.',
                },
              ].map((it, i) => (
                <Reveal key={it.label} delay={80 + i * 80}>
                  <div>
                    <span
                      className="block h-[3px] w-9 rounded-full"
                      style={{ background: 'var(--fd-coral)' }}
                    />
                    <h3
                      className="mt-4 text-[clamp(17px,2vw,20px)] font-extrabold leading-snug"
                      style={{ color: '#FFFFFF' }}
                    >
                      {it.label}
                    </h3>
                    <p
                      className="mt-2.5 text-[14.5px] leading-relaxed"
                      style={{ color: 'rgba(247,245,240,0.74)' }}
                    >
                      {it.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* FAQ — 정직 Q&A (질병 단정·가짜수치·레시피 노출 금지 / 수의사 상담 톤). FAQPage JsonLd 위와 동기 */}
        <Section bg="offwhite" pad="md">
          <Container>
            <Reveal>
              <div className="mx-auto max-w-[560px] text-center">
                <Eyebrow>FAQ</Eyebrow>
                <Display as="h2" size="lg" className="mt-3" style={{ color: 'var(--fd-pine)' }}>
                  신선식, 자주 묻는 것들
                </Display>
              </div>
            </Reveal>
            <div className="mx-auto mt-8 max-w-[680px] md:mt-10">
              {WHYFRESH_FAQ.map((it, i) => (
                <details
                  key={it.q}
                  className="group"
                  style={{
                    background: '#FFFFFF',
                    borderLeft: '1px solid var(--fd-line)',
                    borderRight: '1px solid var(--fd-line)',
                    borderTop: '1px solid var(--fd-line)',
                    borderBottom:
                      i === WHYFRESH_FAQ.length - 1 ? '1px solid var(--fd-line)' : 'none',
                    padding: '18px 20px',
                  }}
                >
                  <summary
                    className="flex items-start justify-between gap-3 cursor-pointer list-none"
                    style={{ color: 'var(--fd-pine)' }}
                  >
                    <span
                      className="flex-1 text-[14px] md:text-[16px]"
                      style={{ fontWeight: 700, letterSpacing: '-0.015em' }}
                    >
                      {it.q}
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 mt-0.5 text-[20px] leading-none transition-transform group-open:rotate-45"
                      style={{ color: 'var(--fd-coral)' }}
                    >
                      +
                    </span>
                  </summary>
                  <p
                    className="mt-3 text-[13px] md:text-[14.5px]"
                    style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}
                  >
                    {it.a}
                  </p>
                </details>
              ))}
            </div>
            <Reveal delay={100}>
              <div className="mt-7 flex justify-center">
                <Button href="/faq" tone="outline" size="sm">
                  자주 묻는 질문 더 보기
                </Button>
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* 마무리 CTA (Phase 2 추가 교육 섹션은 이 위에 더 들어올 수 있음) */}
        <Section bg="cream" pad="md">
          <Container>
            <Reveal>
              <div className="mx-auto max-w-[640px] text-center">
                <Eyebrow>Start here</Eyebrow>
                <Display as="h2" size="lg" className="mx-auto mt-3 max-w-[20ch]" style={{ color: 'var(--fd-pine)' }}>
                  우리 아이에게 신선식이 맞을까요?
                </Display>
                <p
                  className="mx-auto mt-4 max-w-[34ch] text-[clamp(14px,1.7vw,17px)] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  2분 설문이면 우리 아이 몸 상태에 맞춰 신선식 한 끼를 설계해
                  드려요. 무료 분석 먼저, 부담 없이 시작하고 언제든 해지.
                </p>
                <div className="mt-8 flex justify-center">
                  <Button href={planHref} size="lg">
                    2분 설문 시작하기
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </Button>
                </div>
              </div>
            </Reveal>
          </Container>
        </Section>
      </main>
      <StickyCta href={planHref} />
    </WebChrome>
  )
}
