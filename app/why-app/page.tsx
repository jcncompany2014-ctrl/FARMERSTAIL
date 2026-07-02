import type { Metadata } from 'next'
import { ArrowRight, ClipboardList, Smartphone, Sparkles } from 'lucide-react'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import WebChrome from '@/components/WebChrome'
import AppShowcase from '@/components/web/fd/AppShowcase'
import {
  Button,
  Container,
  Display,
  Eyebrow,
  Section,
} from '@/components/web/fd/ui'
import Reveal from '@/components/landing/Reveal'

/**
 * /why-app — "왜 파머스테일 앱인가" 스크롤 쇼케이스 (2026-07-02, 사장님 지시).
 *
 * 레퍼런스: 사장님 첨부 타 앱 랜딩 — 폰 목업 고정 + 스크롤 따라 화면/설명
 * 전환. 핵심 모션은 <AppShowcase /> (components/web/fd/AppShowcase.tsx).
 *
 * 목적: 웹 방문자에게 "설문·주문은 웹, 매일의 케어는 앱" 여정을 보여주고
 * 앱 설치 동기를 부여. 쇼케이스 화면 4종 = 전부 실재 기능(대시보드/분석/
 * 기록/구독관리), 효능 단정·가짜 수치 0, "예시 화면" 명시(정직성 가드).
 *
 * CTA 는 전 마케팅 페이지 관례(planHref: authed → /dogs/new, anon → /start).
 * 앱 자체는 로그인 게이트 뒤라 여기서 직접 열 수 없음 — 가입 후 안내 흐름.
 * auth 는 getSafeUser(6bf5e91 sanctioned 패턴) — stale refresh token 에도 500 없음.
 */
export const revalidate = 3600

const WHYAPP_OG = ogImageUrl({
  title: '왜 파머스테일 앱인가',
  subtitle: '설문은 3분, 케어는 매일',
  tag: 'App',
  variant: 'editorial',
})

export const metadata: Metadata = {
  title: '앱 소개',
  description:
    '하루 급여량 확인부터 식사·산책·체중 기록, 정밀 영양 분석, 정기배송 관리까지 — 파머스테일 앱이 매일의 반려 케어를 어떻게 돕는지 화면으로 보여드려요.',
  alternates: { canonical: '/why-app' },
  openGraph: {
    title: '앱 소개 | 파머스테일',
    description:
      '급여량·기록·영양 분석·정기배송 관리 — 파머스테일 앱의 매일을 화면으로 미리 보기.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/why-app',
    images: [{ url: WHYAPP_OG, width: 1200, height: 630, alt: '왜 파머스테일 앱인가' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '앱 소개 | 파머스테일',
    description:
      '급여량·기록·영양 분석·정기배송 관리 — 파머스테일 앱의 매일을 화면으로 미리 보기.',
    images: [WHYAPP_OG],
  },
  robots: { index: true, follow: true },
}

const START_STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <ClipboardList size={22} strokeWidth={2.2} />,
    title: '3분 설문',
    body: '아이의 체형·입맛·건강 관심사를 알려주시면 맞춤 분석이 시작돼요.',
  },
  {
    icon: <Sparkles size={22} strokeWidth={2.2} />,
    title: '맞춤 플랜 받기',
    body: '하루 급여량과 잘 맞는 레시피 구성을 바로 확인할 수 있어요.',
  },
  {
    icon: <Smartphone size={22} strokeWidth={2.2} />,
    title: '앱에서 매일 케어',
    body: '가입하면 기록·정밀 분석·배송 관리가 앱에서 이어져요.',
  },
]

export default async function WhyAppPage() {
  // 전 마케팅 페이지 동일 관례 — authed → /dogs/new, anon → /start.
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  const planHref = user ? '/dogs/new' : '/start'

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '앱 소개', path: '/why-app' },
  ])

  return (
    <WebChrome>
      <main>
        <JsonLd id="ld-whyapp-crumbs" data={crumbLd} />

        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container>
            <div className="mx-auto max-w-[720px] text-center">
              <Reveal>
                <Eyebrow>Farmer&apos;s Tail App</Eyebrow>
                <Display as="h1" size="xl" className="mt-3">
                  설문은 3분,
                  <br />
                  케어는 매일 — 앱에서
                </Display>
                <p
                  className="mx-auto mt-5 max-w-[44ch] text-[clamp(15px,1.8vw,18px)] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  맞춤 식단은 시작일 뿐이에요. 오늘 얼마나 먹일지, 산책은
                  얼마나 했는지, 다음 박스는 언제 오는지 — 매일의 반려 케어가
                  파머스테일 앱 하나에 담겨 있어요.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button href={planHref} size="lg">
                    무료 분석으로 시작하기
                    <ArrowRight size={18} strokeWidth={2.4} />
                  </Button>
                </div>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 스크롤 쇼케이스 — 폰 목업 고정 + 화면 전환 */}
        <Section bg="offwhite" pad="sm" className="overflow-clip">
          <AppShowcase />
        </Section>

        {/* 이렇게 시작해요 */}
        <Section bg="pine" pad="lg">
          <Container>
            <div className="text-center">
              <Reveal>
                <Eyebrow color="rgba(255,255,255,0.72)">How to Start</Eyebrow>
                <Display as="h2" size="lg" className="mt-3" style={{ color: '#FFFFFF' }}>
                  이렇게 시작해요
                </Display>
              </Reveal>
            </div>
            <div className="mx-auto mt-12 grid max-w-[880px] gap-4 md:grid-cols-3 md:gap-6">
              {START_STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <div
                    className="h-full text-center"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      borderRadius: 8,
                      padding: '28px 22px',
                    }}
                  >
                    <div
                      className="mx-auto flex items-center justify-center"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 999,
                        background: 'var(--fd-cream)',
                        color: 'var(--fd-pine)',
                      }}
                    >
                      {s.icon}
                    </div>
                    <div
                      className="mt-4"
                      style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}
                    >
                      STEP {i + 1}
                    </div>
                    <div className="mt-1" style={{ fontSize: 19, fontWeight: 900, color: '#FFFFFF' }}>
                      {s.title}
                    </div>
                    <p
                      className="mt-2"
                      style={{ fontSize: 13.5, lineHeight: 1.6, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}
                    >
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Reveal>
                <Button href={planHref} tone="cream" size="lg">
                  무료 분석으로 시작하기
                  <ArrowRight size={18} strokeWidth={2.4} />
                </Button>
                <p className="mt-4" style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.62)' }}>
                  파머스테일 앱은 가입 후 안내에 따라 홈 화면에 추가할 수 있어요.
                </p>
              </Reveal>
            </div>
          </Container>
        </Section>
      </main>
    </WebChrome>
  )
}
