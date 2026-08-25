'use client'

/**
 * Farmer's Tail — 첫 설치 온보딩 (2026-08-25 전면 개편, 사장님 지시).
 *
 * # 왜 갈아엎었나
 * 이전 4장은 전부 **브랜드 소개**였다("진짜 밥 / 2분 분석 / 정기배송 / 시작").
 * 그런데 앱을 설치한 사람은 이미 우리 브랜드를 안다 — 웹 설문·인스타·검색을
 * 거쳐 왔기 때문이다. 정작 처음 보는 궁금증인 **"이 앱으로 뭘 할 수 있나"**
 * 는 한 장도 없었다. 실제로 앱에는 건강 일지·체중 추이·수의사 진료 보고서·
 * 구독 관리가 다 있는데 온보딩이 하나도 안 알려줬다(사장님: "브랜드 소개서
 * 같아서 — 앱 소개서로 바꾸자").
 *
 * # 그래서 지금은
 * **실제 앱 화면 스크린샷**(에뮬레이터 실촬영, `public/onboarding/app-*.webp`)
 * 을 **실사 기기 목업**(생성) 화면 안에 sharp 로 끼워넣은 `mock-*.webp` 를
 * 쓴다. 앱스토어 스크린샷 방식 — 정직하고("이게 진짜 되네"), UI 가 바뀌면
 * 다시 찍어 합성만 하면 된다.
 * ⚠️ 화면 내용·폰트는 **AI 로 다시 그리지 않는다** — 한글이 뭉개진다.
 *    기기(베젤·그림자)만 생성물이고, 화면은 원본 픽셀 그대로다.
 *
 * 순서는 사장님 지정: ①맞춤 분석 결과 ②건강 일지·체중 추이
 * ③수의사 진료 보고서 ④편한 구독 관리(+CTA).
 *
 * OnboardingGate 가 첫 설치(standalone) 1회만 /welcome 으로 보내고, 이
 * 컴포넌트가 완료/스킵 시 markOnboarded() 후 /start 또는 /login 으로 이동한다.
 * position:fixed 전체화면 takeover.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markOnboarded } from '@/lib/onboarding'

type Slide = {
  shot: string
  kicker: string
  title: string
  sub: string
}

const SLIDES: Slide[] = [
  {
    shot: '/onboarding/mock-analysis.webp',
    kicker: '맞춤 분석',
    title: '우리 아이 몸에 맞는\n하루 한 끼',
    sub: '체형·건강·기호를 분석해 필요한 열량과\n레시피를 계산해요. 급여량까지 그램 단위로.',
  },
  {
    shot: '/onboarding/mock-health.webp',
    kicker: '건강 일지',
    title: '오늘 컨디션,\n한 줄이면 끝',
    sub: '변 상태·활동량·기분을 톡 눌러 기록하면\n지난 30일 변화가 한눈에 쌓여요.',
  },
  {
    shot: '/onboarding/mock-vet.webp',
    kicker: '수의사 보고서',
    title: '병원 갈 때,\n종이 한 장이면',
    sub: '12개월 체중 추이·식이·분석을 A4 한 장으로.\n수의사에게 그대로 보여드리면 돼요.',
  },
  {
    shot: '/onboarding/mock-subscription.webp',
    kicker: '구독 관리',
    title: '바꾸고 미루는 게\n제일 쉬워요',
    sub: '화식 비율·배송일 변경, 일시정지와 해지까지\n앱에서 몇 번만 누르면 끝나요.',
  },
]
const LAST = SLIDES.length - 1

export default function Onboarding() {
  const router = useRouter()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [idx, setIdx] = useState(0)

  const goTo = useCallback((i: number) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setIdx((prev) => (prev === i ? prev : i))
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function complete(path: string) {
    markOnboarded()
    router.replace(path)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        // 크림 배경 — 앱 화면(밝은 톤)을 얹으므로 어두운 배경보다 이어진다.
        background: 'var(--bg, #FAF7F2)',
        overflow: 'hidden',
      }}
    >
      {/* 진행 점 + 건너뛰기 (고정) */}
      <div
        style={{
          position: 'absolute',
          top: 'max(14px, env(safe-area-inset-top))',
          left: 0,
          right: 0,
          zIndex: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((s, i) => (
            <button
              key={s.shot}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번 슬라이드`}
              style={{
                width: i === idx ? 22 : 7,
                height: 7,
                borderRadius: 99,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background:
                  i === idx ? 'var(--terracotta, #C86B45)' : 'rgba(60,40,26,0.22)',
                transition: 'width 240ms ease, background 240ms ease',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(LAST)}
          style={{
            visibility: idx < LAST ? 'visible' : 'hidden',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted, #7A6A58)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 4px',
          }}
        >
          건너뛰기
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{
          height: '100%',
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {SLIDES.map((s, i) => (
          <section
            key={s.shot}
            style={{
              position: 'relative',
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding:
                'max(56px, calc(env(safe-area-inset-top) + 44px)) 22px calc(22px + env(safe-area-inset-bottom))',
            }}
          >
            {/* 카피 — 화면 위쪽. 스크린샷보다 먼저 읽히게. */}
            <div style={{ flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: 'var(--terracotta, #C86B45)',
                }}
              >
                {s.kicker}
              </span>
              <h1
                style={{
                  margin: '8px 0 0',
                  fontSize: 27,
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: 'var(--ink, #2A1F16)',
                  whiteSpace: 'pre-line',
                }}
              >
                {s.title}
              </h1>
              <p
                style={{
                  margin: '9px 0 0',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: 'var(--muted, #7A6A58)',
                  whiteSpace: 'pre-line',
                  fontWeight: 500,
                }}
              >
                {s.sub}
              </p>
            </div>

            {/* 폰 프레임 + 실제 앱 화면 + 손그림 강조 */}
            <PhoneShot slide={s} eager={i === 0} />

            {/* 버튼 — 항상 바닥. */}
            <div style={{ flexShrink: 0, marginTop: 14 }}>
              {i < LAST ? (
                <button
                  type="button"
                  onClick={() => goTo(i + 1)}
                  style={btnPrimary}
                >
                  다음
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <button
                    type="button"
                    onClick={() => complete('/start')}
                    style={btnPrimary}
                  >
                    무료로 시작하기
                  </button>
                  <button
                    type="button"
                    onClick={() => complete('/login')}
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 999,
                      border: '1.5px solid var(--rule, #E4DBCE)',
                      background: 'transparent',
                      color: 'var(--ink, #2A1F16)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    이미 계정이 있어요
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  height: 54,
  borderRadius: 999,
  border: 'none',
  background: 'var(--terracotta, #C86B45)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  boxShadow: '0 10px 26px -12px rgba(200,107,69,0.75)',
}

/**
 * 기기 목업 이미지 — 실사 기기 사진 안에 **실제 앱 화면 픽셀이 그대로** 박혀
 * 있다(`scripts` 없이 sharp 로 합성, 원본은 `app-*.webp`).
 *
 * 이전엔 CSS 로 테두리를 그리고 SVG 동그라미로 강조했는데 사장님 평가는
 * "폰 레이어도 못생겼고 동그라미도 못생겼다 — 완성도가 떨어진다". 맞는 말이라
 * 기기는 생성 목업(실사 그림자·베젤)으로, 강조는 아예 걷어냈다. 화면 내용과
 * 폰트는 손대지 않았다 — AI 가 다시 그리면 한글이 뭉개지므로 **절대 금지**.
 */
function PhoneShot({ slide, eager }: { slide: Slide; eager: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        marginTop: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      {/* ★loading="lazy" 금지 (2026-08-25 실측): 안드로이드 WebView 에서 가로
          캐러셀의 2~4번째 장이 영영 로드되지 않았다(naturalWidth 0). 4장 합계
          135KB 라 전부 eager 로 받아도 부담 없다 — 첫 장만 우선순위를 높인다. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 목업 이미지, next/image 이득 없음 */}
      <img
        src={slide.shot}
        alt=""
        fetchPriority={eager ? 'high' : 'low'}
        decoding="async"
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
          objectPosition: 'top center',
        }}
      />
    </div>
  )
}
