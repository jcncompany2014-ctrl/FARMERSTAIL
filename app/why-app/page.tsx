import type { Metadata } from 'next'
import {
  ArrowLeftRight,
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  Coins,
  FileText,
  LineChart,
  Smartphone,
  Sparkles,
} from 'lucide-react'
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
import { Polaroid } from '@/components/web/fd/Polaroid'
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

// 전부 실재 앱 화면 — /dogs/[id]/photos·diary, 체중 로그·변화감지, vet-report,
// dogs/compare, mypage/points·membership, year-in-review.
const MORE_FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Camera size={20} strokeWidth={2} />,
    title: '사진 일지',
    body: '산책과 식사, 오늘의 순간을 사진으로 남기는 아이 전용 일지예요.',
  },
  {
    icon: <LineChart size={20} strokeWidth={2} />,
    title: '체중 추이 그래프',
    body: '기록한 체중이 그래프로 쌓여요. 갑작스러운 변화는 감지해서 재분석으로 이어져요.',
  },
  {
    icon: <FileText size={20} strokeWidth={2} />,
    title: '수의사 리포트',
    body: '병원 갈 때 그동안의 기록을 리포트로 정리해 수의사 선생님께 보여줄 수 있어요.',
  },
  {
    icon: <ArrowLeftRight size={20} strokeWidth={2} />,
    title: '다견 비교',
    body: '여러 아이를 키운다면, 아이들의 상태를 나란히 놓고 비교해볼 수 있어요.',
  },
  {
    icon: <Coins size={20} strokeWidth={2} />,
    title: '멤버십 등급 혜택',
    body: '구독 결제로 스탬프를 모아 등급이 오르면, 최종 등급에서 주문 할인이 자동으로 적용돼요.',
  },
  {
    icon: <Sparkles size={20} strokeWidth={2} />,
    title: '연말 리뷰',
    body: '일 년의 기록을 모아 우리 아이의 한 해를 돌아보는 특별한 리뷰를 만들어드려요.',
  },
]

// 정직한 역할 분리 — 웹으로 되는 것과 앱에서만 되는 것.
const WEB_ROLES = ['3분 설문과 맞춤 플랜 확인', '정기배송 주문과 결제', '주문 내역 · 계정 관리']
const APP_ROLES = [
  '매일의 식사 · 산책 · 체중 기록',
  '정밀 영양 분석과 건강 수첩',
  '가족 공유 · 리마인더 푸시 알림',
]

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

        {/* 이 모든 게 앱에 있어요 — 추가 실기능 그리드 */}
        <Section bg="cream" pad="lg">
          <Container>
            <div className="text-center">
              <Reveal>
                <Eyebrow>And More</Eyebrow>
                <Display as="h2" size="lg" className="mt-3">
                  이 모든 게 앱에 있어요
                </Display>
                <p
                  className="mx-auto mt-4 max-w-[44ch] text-[15px] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  전부 지금 앱에서 실제로 쓸 수 있는 기능들이에요.
                </p>
              </Reveal>
            </div>
            {/* de-AI 그리드 브레이크 — 살짝 기울인 폴라로이드 + 손글씨 캡션이
                아래 정렬 그리드의 완벽함을 깬다. ⚠️ 스왑 슬롯: 사장님 실사 도착 시
                src/alt/caption 만 교체(지금은 기존 이미지 placeholder). */}
            <div className="mt-10 flex justify-center">
              <Reveal>
                <Polaroid
                  src="/dog-poodle.jpg"
                  alt="파머스테일 앱으로 매일을 기록하는 반려견"
                  caption="우리 아이의 하루"
                  rotate={-3}
                  width={230}
                />
              </Reveal>
            </div>
            <div className="mx-auto mt-8 grid max-w-[980px] gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
              {MORE_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  <div
                    className="h-full"
                    style={{ background: '#FFFFFF', borderRadius: 8, padding: '24px 22px' }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: 'var(--fd-offwhite)',
                        color: 'var(--fd-green)',
                      }}
                    >
                      {f.icon}
                    </div>
                    <div className="mt-4" style={{ fontSize: 17, fontWeight: 800, color: 'var(--fd-pine)' }}>
                      {f.title}
                    </div>
                    <p className="mt-2" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--fd-muted)' }}>
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* 웹과 앱, 역할이 달라요 — 정직한 분리 */}
        <Section bg="offwhite" pad="lg">
          <Container size="md">
            <div className="text-center">
              <Reveal>
                <Eyebrow>Web &amp; App</Eyebrow>
                <Display as="h2" size="lg" className="mt-3">
                  주문까지는 웹으로,
                  <br />
                  아이와의 매일은 앱에서
                </Display>
                <p
                  className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  설문과 주문은 웹으로도 충분해요. 하지만 매일 기록하고, 잊지 않게
                  챙겨주고, 가족과 나누는 일 — 아이와의 하루하루는 앱에 있어요.
                </p>
              </Reveal>
            </div>
            <div className="mx-auto mt-10 grid max-w-[760px] gap-4 md:grid-cols-2 md:gap-6">
              <Reveal>
                <div
                  className="h-full"
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 8,
                    padding: '26px 24px',
                    border: '1px solid var(--fd-line)',
                  }}
                >
                  <Eyebrow color="var(--fd-muted)">Web</Eyebrow>
                  <div className="mt-2" style={{ fontSize: 19, fontWeight: 900, color: 'var(--fd-pine)' }}>
                    웹에서는
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {WEB_ROLES.map((r) => (
                      <li key={r} className="flex items-start gap-2.5" style={{ fontSize: 14, color: 'var(--fd-muted)', fontWeight: 500 }}>
                        <Check size={15} strokeWidth={2.6} style={{ color: 'var(--fd-muted)', marginTop: 2, flexShrink: 0 }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={90}>
                <div
                  className="h-full"
                  style={{ background: 'var(--fd-pine)', borderRadius: 8, padding: '26px 24px' }}
                >
                  <Eyebrow color="rgba(255,255,255,0.7)">App</Eyebrow>
                  <div className="mt-2" style={{ fontSize: 19, fontWeight: 900, color: '#FFFFFF' }}>
                    앱에서는 여기에 더해
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {APP_ROLES.map((r) => (
                      <li key={r} className="flex items-start gap-2.5" style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>
                        <Check size={15} strokeWidth={2.6} style={{ color: 'var(--fd-gold, #E5A93B)', marginTop: 2, flexShrink: 0 }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </Container>
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
