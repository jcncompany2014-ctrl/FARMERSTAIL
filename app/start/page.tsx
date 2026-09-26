import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import WebChrome from '@/components/WebChrome'
import StartAppShell from '@/components/start/StartAppShell'
import { isAppContextServer } from '@/lib/app-context'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { planHref } from '@/lib/funnel-cta'
import Reveal from '@/components/landing/Reveal'
import { Section, Container, Display, Eyebrow, PhotoSlot } from '@/components/web/fd/ui'
import StartClient from './StartClient'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'

/**
 * /start — FD식 무료 맞춤분석 퍼널 진입 (트랙B B1b).
 *
 * 비회원이 가입 없이 바로 시작하는 익명 설문의 시작점.
 *   스텝0(강아지 기본) → 설문 → 결과 직전 가입(B4) → 초안→계정 이관(B5).
 * 웹 마케팅 라우트 규칙: 이 page 가 직접 WebChrome 를 렌더, layout 은 pass-through
 * (AuthAwareShell 무력화 — 앱 PWA 이중 chrome 방지). /partners·/brand 와 동일.
 *
 * B1b 완료: 히어로 + 스텝0 폼(StartClient, 강아지 기본 8필드, 익명 draft 저장)
 * + 진행 안내(3스텝). 진입 CTA wiring(planHref→/start)은 퍼널 전체 완성 후 B6.
 * 미완성 동안 robots noindex (반쪽 페이지 색인 방지). 다음=B2 익명 설문 엔진.
 */
export const metadata: Metadata = {
  title: '무료 맞춤 분석 시작',
  description:
    '가입 없이 2분이면, 우리 아이에게 맞는 수의영양 기반 식단을 받아볼 수 있어요. 강아지 정보와 생활 습관만 알려주세요.',
  alternates: { canonical: '/start' },
  // 카카오 우선 퍼널 완성 → 색인 허용(사장님 2026-06-16). 이제 모든 진입 CTA 가
  // 이 페이지로 모이는 실제 퍼널 시작점.
  robots: { index: true, follow: true },
  // 계획 D1(2026-07-25) — OG 를 안 주면 root layout 의 사이트 기본값이 그대로
  // 쓰인다. Next 는 page 의 title/description 을 openGraph 로 자동 복사하지
  // 않기 때문. 인스타·카톡으로 이 링크를 뿌리는데 미리보기에 "파머스테일"
  // 이라는 일반 문구만 떠서 뭘 누르는 건지 알 수 없었다. 이미지는 사이트
  // 기본(/og)을 그대로 상속한다.
  openGraph: {
    title: '무료 맞춤 분석 — 2분이면 끝나요',
    description:
      '가입 없이 2분이면, 우리 아이에게 맞는 수의영양 기반 식단을 받아볼 수 있어요.',
    url: '/start',
  },
}

// [n, 제목, 설명] — 단계 카드. 사진은 2026-09-22 사장님 지시로 전부 뺐다("여기에 들어가는
// 사진 일단 다 빼자"): 01·02 는 AI 생성(힉스필드 2026-07-03)이라 실촬영 전까지 보류,
// 03 은 우리 화식 그릇으로 바꿨다가 셋의 톤이 안 맞아 같이 뺌. 실촬영 3장이 생기면
// PhotoSlot(ratio 3/2) 로 되살린다.
const FLOW: [string, string, string][] = [
  ['01', '강아지 기본', '이름·체중·생일 등 기본 정보를 알려주세요.'],
  ['02', '생활·건강 설문', '체형·소화·식습관·건강 상태를 차근차근 여쭤봐요.'],
  ['03', '맞춤 결과', '수의영양 기준으로 분석한 결과를 확인하고, 저장하려면 가입해요.'],
]

export default async function StartPage() {
  // ★앱 컨텍스트면 WebChrome(웹 마케팅 헤더/푸터) 대신 미니멀 앱 셸 —
  //   앱에서 "무료 맞춤분석" 눌렀을 때 웹 화면이 뜨던 것 차단(사장님 B안,
  //   2026-07-19). 웹은 기존 WebChrome 그대로.
  const isApp = await isAppContextServer()
  // ★ 익명 전용 퍼널 가드 (사장님 제보 2026-08-24, 규칙62): 이 퍼널의 끝은
  //   가입 폼이라 로그인 사용자는 끝까지 가도 "이미 가입된 이메일" 에서 막힌다.
  //   CTA 는 planHref 가 이미 분기하지만 직접 진입(북마크·QR)은 CTA 를 안
  //   거치므로 페이지가 직접 가드한다. 목적지는 planHref 정본 그대로.
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  if (user) redirect(planHref(true, isApp))
  const body = (
      <main>
        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
              <Reveal>
                <Eyebrow>WELCOME · 무료 맞춤 분석</Eyebrow>
                <Display
                  as="h1"
                  size="xl"
                  className="pt-4"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  새로 오셨어요?
                  <br />
                  우리 아이부터 알려주세요
                </Display>
                <p
                  className="pt-5 text-[17px] md:text-[18px]"
                  style={{ maxWidth: 560, lineHeight: 1.7, color: 'var(--fd-muted)' }}
                >
                  가입은 나중에 해도 괜찮아요. 먼저 2분 설문으로 우리 아이에게
                  맞는 수의영양 기준 식단을 받아보세요. 결과가 마음에 들면 그때
                  저장하면 돼요.
                </p>
              </Reveal>
              {/* 📸 메인 비주얼 — 2026-09-02 실촬영분으로 교체(예고됐던 그 교체).
                  강아지 + 신선식 그릇 + 정량을 덜어 주는 손. */}
              <Reveal delay={120}>
                <PhotoSlot
                  label="메인 비주얼"
                  src="/serving-custom.jpg"
                  alt="신선한 화식을 그릇에 받는 강아지"
                  ratio="4 / 3"
                  tone="cream"
                  rounded={18}
                  className="w-full"
                  // 폴드 안 대표 사진 — lazy 면 LCP 가 그대로 밀린다.
                  eager
                />
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* 스텝0 — 강아지 기본 (인터랙티브, 익명 초안 저장) */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Reveal>
              <Eyebrow>Step 1 · 강아지 기본</Eyebrow>
              {/* 퍼널 진행 표시 — 설문(StartSurvey)의 진행바와 일관(3단계 중 1단계). */}
              <div className="pt-3 flex items-center gap-3" aria-label="진행 단계 1 / 3">
                <div className="flex-1 flex gap-1.5" aria-hidden="true">
                  {[0, 1, 2].map((s) => (
                    <span
                      key={s}
                      style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 999,
                        background: s === 0 ? 'var(--fd-coral)' : 'var(--fd-line)',
                      }}
                    />
                  ))}
                </div>
                <span
                  className="tnum"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--fd-muted)', fontVariantNumeric: 'lining-nums tabular-nums' }}
                >
                  1 / 3
                </span>
              </div>
              <p
                className="pt-3 pb-6 text-[15px] md:text-[17px]"
                style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}
              >
                먼저 우리 아이를 알려주세요. 입력하신 내용은 이 브라우저에 임시
                저장돼, 가입하실 때 그대로 옮겨드려요.
              </p>
            </Reveal>
            {/* 📸 스텝0 환영 배너 — AI 생성(힉스필드 2026-07-03, 실촬영 교체 대상).
                좌측 여백 있는 와이드 컷이라 16/5 슬림 크롭에 어울림. */}
            <Reveal delay={80}>
              <PhotoSlot
                label="환영 배너"
                src="/start-welcome-banner.jpg"
                alt="창가에 나란히 앉은 강아지들"
                ratio="16 / 5"
                tone="green"
                rounded={14}
                className="w-full mb-7"
              />
            </Reveal>
            <StartClient />
          </Container>
        </Section>

        {/* 진행 안내 — 3스텝 */}
        <Section bg="cream" pad="md">
          <Container size="lg">
            <Reveal>
              <Eyebrow>How it works · 이렇게 진행돼요</Eyebrow>
              <Display as="h2" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                3단계면 충분해요
              </Display>
            </Reveal>
            <ul className="pt-6 grid gap-4 md:grid-cols-3">
              {FLOW.map(([n, t, d], i) => (
                <Reveal key={n} delay={i * 80}>
                  <li
                    className="rounded-[12px] h-full px-5 py-6"
                    style={{
                      background: 'var(--fd-offwhite)',
                      boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                    }}
                  >
                    <span
                      className="tnum"
                      style={{
                        color: 'var(--fd-coral)',
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'lining-nums tabular-nums',
                      }}
                    >
                      {n}
                    </span>
                    <h3
                      className="pt-2 text-[18px] md:text-[18px]"
                      style={{
                        fontWeight: 800,
                        color: 'var(--fd-pine)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {t}
                    </h3>
                    <p
                      className="pt-1.5 text-[15px] md:text-[16px]"
                      style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}
                    >
                      {d}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </Container>
        </Section>
      </main>
  )

  // 앱 컨텍스트 본문 — 웹 마케팅 히어로(4/3 사진)·3-step 사진 카드를 걷어낸
  // 린 앱 톤. 폼(StartClient)은 그대로 재사용하되 FD 토큰만 앱 토큰으로 스코프
  // 스왑(로직 무손상 · subscriptions 페이지와 동일하게 pine/muted/line 3개만,
  // offwhite·coral 은 앱/웹 동일 hex). 사장님 B안 "웹 설문을 앱 톤으로 리스킨"
  // (2026-07-19)의 본문 리스킨 — 셸 분기(StartAppShell)는 이미 됐고, 본문이 웹톤
  // 으로 남아 "앱 안에 웹 화면" 이던 잔재를 정리(feedback_app_native_feel).
  // FD 토큰 → 앱 토큰 스코프 스왑(subscriptions 페이지와 동일 3개). 커스텀
  // 프로퍼티 키는 style 리터럴 직접 지정 시 excess-property 체크에 걸리므로
  // const 로 빼서 스프레드(스프레드는 EPC 안 탐).
  const appTokenSwap: Record<`--${string}`, string> = {
    '--fd-pine': 'var(--ink)',
    '--fd-muted': 'var(--muted)',
    '--fd-line': 'var(--rule)',
  }
  const appBody = (
    <main className="px-5 pt-7 pb-20" style={{ ...appTokenSwap }}>
      <h1
        className="font-sans"
        style={{
          fontSize: 27,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          lineHeight: 1.22,
        }}
      >
        우리 아이부터
        <br />
        알려주세요
      </h1>
      <p
        className="mt-2.5 text-[15px]"
        style={{ color: 'var(--muted)', lineHeight: 1.65 }}
      >
        2분이면 돼요. 가입은 결과가 마음에 들 때 해도 괜찮아요.
      </p>

      {/* 진행 표시 — 3단계(웹의 사진 3-step 카드는 앱에서 생략, 스크롤↓). */}
      <div className="mt-5 flex items-center gap-3" aria-label="진행 단계 1 / 3">
        <div className="flex-1 flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((s) => (
            <span
              key={s}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 999,
                background: s === 0 ? 'var(--fd-coral)' : 'var(--rule)',
              }}
            />
          ))}
        </div>
        <span
          className="tnum"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--muted)',
            fontVariantNumeric: 'lining-nums tabular-nums',
          }}
        >
          1 / 3
        </span>
      </div>

      <div className="mt-6">
        <StartClient isApp />
      </div>
    </main>
  )

  if (isApp) return <StartAppShell>{appBody}</StartAppShell>
  // 인앱 브라우저 안내는 이 첫 화면에서만(설문 진입 전 — 초안이 아직 없어 크롬으로
  // 옮겨도 잃을 게 없는 유일한 지점). 웹 분기 전용.
  return (
    <>
      <InAppBrowserNotice />
      <WebChrome>{body}</WebChrome>
    </>
  )
}
