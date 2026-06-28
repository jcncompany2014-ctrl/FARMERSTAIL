import type { Metadata } from 'next'
import WebChrome from '@/components/WebChrome'
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

const FLOW: [string, string, string, string][] = [
  ['01', '강아지 기본', '이름·체중·나이·활동량 등 기본 정보를 알려주세요.', '강아지 일러스트 (누끼)'],
  ['02', '생활·건강 설문', '체형·소화·식습관·건강 상태를 차근차근 여쭤봐요.', '설문 체크리스트 일러스트'],
  ['03', '맞춤 결과', '수의영양 기준으로 분석한 결과를 확인하고, 저장하려면 가입해요.', '결과·신선식 상품 누끼'],
]

export default function StartPage() {
  return (
    <WebChrome>
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
                  가입은 나중에 해도 괜찮아요. 먼저 2분 설문으로, 우리 아이에게
                  맞는 수의영양 기준 식단을 받아보세요. 결과가 마음에 들면 그때
                  저장하면 됩니다.
                </p>
              </Reveal>
              {/* 📸 메인 비주얼 — 강아지 + 신선식 누끼 (히어로 대표 이미지) */}
              <Reveal delay={120}>
                <PhotoSlot
                  label="메인 비주얼 · 강아지 + 신선식 누끼"
                  sub="정면 강아지 또는 밥그릇·상품 컷"
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
            {/* 📸 스텝0 환영 배너 — 강아지 일러스트 (슬림) */}
            <Reveal delay={80}>
              <PhotoSlot
                label="환영 일러스트 · 강아지 (슬림 배너)"
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
              {FLOW.map(([n, t, d, ill], i) => (
                <Reveal key={n} delay={i * 80}>
                  <li
                    className="rounded-[12px] h-full px-5 py-6"
                    style={{
                      background: 'var(--fd-offwhite)',
                      boxShadow: 'inset 0 0 0 1px var(--fd-line)',
                    }}
                  >
                    {/* 📸 단계별 일러스트 (누끼, 작게) */}
                    <PhotoSlot
                      label={ill}
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
    </WebChrome>
  )
}
