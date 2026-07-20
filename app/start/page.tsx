import type { Metadata } from 'next'
import WebChrome from '@/components/WebChrome'
import StartAppShell from '@/components/start/StartAppShell'
import { isAppContextServer } from '@/lib/app-context'
import Reveal from '@/components/landing/Reveal'
import { Section, Container, Display, Eyebrow, PhotoSlot } from '@/components/web/fd/ui'
import StartClient from './StartClient'

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
}

// [n, 제목, 설명, 라벨(alt), 이미지 src] — 이미지는 2026-07-03 AI 생성(힉스필드,
// 실촬영 교체 대상). 브리프 그대로: 강아지·신선재료·완성 그릇.
const FLOW: [string, string, string, string, string][] = [
  ['01', '강아지 기본', '이름·체중·생일 등 기본 정보를 알려주세요.', '강아지 사진', '/start-step-dog.jpg'],
  ['02', '생활·건강 설문', '체형·소화·식습관·건강 상태를 차근차근 여쭤봐요.', '신선한 재료들', '/start-step-ingredients.jpg'],
  ['03', '맞춤 결과', '수의영양 기준으로 분석한 결과를 확인하고, 저장하려면 가입해요.', '완성된 신선식 한 그릇', '/start-step-bowl.jpg'],
]

export default async function StartPage() {
  // ★앱 컨텍스트면 WebChrome(웹 마케팅 헤더/푸터) 대신 미니멀 앱 셸 —
  //   앱에서 "무료 맞춤분석" 눌렀을 때 웹 화면이 뜨던 것 차단(사장님 B안,
  //   2026-07-19). 웹은 기존 WebChrome 그대로.
  const isApp = await isAppContextServer()
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
                  className="pt-5 text-[15px] md:text-[18px]"
                  style={{ maxWidth: 560, lineHeight: 1.7, color: 'var(--fd-muted)' }}
                >
                  가입은 나중에 해도 괜찮아요. 먼저 2분 설문으로 우리 아이에게
                  맞는 수의영양 기준 식단을 받아보세요. 결과가 마음에 들면 그때
                  저장하면 돼요.
                </p>
              </Reveal>
              {/* 📸 메인 비주얼 — AI 생성 테스트 이미지(2026-07-03, 힉스필드).
                  실촬영 나오면 교체. 정면 강아지 + 신선식 그릇(브리프 그대로). */}
              <Reveal delay={120}>
                <PhotoSlot
                  label="메인 비주얼"
                  src="/start-hero.jpg"
                  alt="신선한 화식 한 그릇 앞에 앉아 있는 강아지"
                  ratio="4 / 3"
                  tone="cream"
                  rounded={18}
                  className="w-full"
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
                  style={{ fontSize: 11, fontWeight: 700, color: 'var(--fd-muted)', fontVariantNumeric: 'lining-nums tabular-nums' }}
                >
                  1 / 3
                </span>
              </div>
              <p
                className="pt-3 pb-6 text-[13.5px] md:text-[15px]"
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
              {FLOW.map(([n, t, d, ill, img], i) => (
                <Reveal key={n} delay={i * 80}>
                  <li
                    className="rounded-[12px] h-full px-5 py-6"
                    style={{
                      background: 'var(--fd-offwhite)',
                      boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                    }}
                  >
                    {/* 📸 단계별 사진 — AI 생성(힉스필드 2026-07-03) */}
                    <PhotoSlot
                      label={ill}
                      src={img}
                      alt={ill}
                      ratio="3 / 2"
                      tone={i === 2 ? 'coral' : i === 1 ? 'green' : 'cream'}
                      rounded={10}
                      className="w-full mb-4"
                    />
                    <span
                      className="tnum"
                      style={{
                        color: 'var(--fd-coral)',
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'lining-nums tabular-nums',
                      }}
                    >
                      {n}
                    </span>
                    <h3
                      className="pt-2 text-[16px] md:text-[18px]"
                      style={{
                        fontWeight: 800,
                        color: 'var(--fd-pine)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {t}
                    </h3>
                    <p
                      className="pt-1.5 text-[13px] md:text-[14px]"
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
        className="mt-2.5 text-[13.5px]"
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
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            fontVariantNumeric: 'lining-nums tabular-nums',
          }}
        >
          1 / 3
        </span>
      </div>

      <div className="mt-6">
        <StartClient />
      </div>
    </main>
  )

  if (isApp) return <StartAppShell>{appBody}</StartAppShell>
  return <WebChrome>{body}</WebChrome>
}
