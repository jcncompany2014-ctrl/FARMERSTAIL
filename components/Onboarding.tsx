'use client'

/**
 * Farmer's Tail — 첫 설치 온보딩.
 *
 * # 레이아웃 정본 = 국내 앱스토어 스크린샷 문법 (사장님 레퍼런스: 필라이즈)
 *   ① 큰 두 줄 헤드라인 — 1줄 조건/행동, 2줄 결과(더 굵고 진하게).
 *   ② 폰이 아래로 잘려 나간다 — 여백 안에 얌전히 들어가면 작아 보인다.
 *      흰 패널이 폰을 아래에서 자르므로 "카드 밖으로 이어진다"로 읽힌다.
 *   ③ 폰 가장자리에 뜨는 배지 — 기능은 텍스트 칩, 제품은 원형 실사진.
 *
 * # 화면 이미지
 * 실촬영 앱 스크린샷(`app-*.webp`)을 실사 기기 목업 안에 sharp 로 끼워넣은
 * `mock-*.webp`. ⚠️ 화면 내용·폰트는 **AI 로 다시 그리지 않는다**(한글이 뭉개짐).
 * 기기(베젤·그림자)만 생성물이고 화면은 원본 픽셀 그대로다.
 *
 * # 내용은 브랜드 소개가 아니라 앱 소개
 * 설치한 사람은 웹 설문·인스타를 거쳐 와서 브랜드를 이미 안다. 정작 모르는
 * "이 앱으로 뭘 하나"를 보여준다. 순서는 사장님 지정:
 * ①맞춤 분석 ②건강 일지 ③수의사 보고서 ④구독 관리(+CTA).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markOnboarded } from '@/lib/onboarding'

type Badge =
  | { kind: 'chip'; text: string; tone: 'accent' | 'plain'; side: 'left' | 'right'; top: string }
  | { kind: 'photo'; src: string; side: 'left' | 'right'; top: string }

type Slide = {
  shot: string
  lead: string
  punch: string
  note: string
  badges: Badge[]
}

const SLIDES: Slide[] = [
  {
    shot: '/onboarding/mock-analysis.webp',
    lead: '체형·건강·기호를 입력하면',
    punch: '맞춤 레시피가 나와요',
    note: '필요한 열량과 하루 급여량까지 그램 단위로 계산해요',
    badges: [
      { kind: 'chip', text: '그램 단위 급여량', tone: 'accent', side: 'left', top: '5%' },
      { kind: 'photo', src: '/bowl/chicken.webp', side: 'right', top: '25%' },
    ],
  },
  {
    shot: '/onboarding/mock-health.webp',
    lead: '오늘 컨디션 톡 누르면',
    punch: '건강 기록이 쌓여요',
    note: '변 상태·활동량·기분과 체중 추이를 한 화면에서 봐요',
    badges: [
      { kind: 'chip', text: '체중 추이', tone: 'plain', side: 'right', top: '8%' },
      { kind: 'chip', text: '30일 변화', tone: 'accent', side: 'left', top: '38%' },
    ],
  },
  {
    shot: '/onboarding/mock-vet.webp',
    lead: '병원 갈 때는',
    punch: '종이 한 장이면 끝나요',
    note: '12개월 체중·식이·분석 기록을 A4 한 장으로 정리해 드려요',
    badges: [
      { kind: 'chip', text: '12개월 기록', tone: 'accent', side: 'left', top: '6%' },
      { kind: 'chip', text: 'PDF 저장', tone: 'plain', side: 'right', top: '34%' },
    ],
  },
  {
    shot: '/onboarding/mock-subscription.webp',
    lead: '바꾸고 미루는 것까지',
    punch: '앱에서 몇 번이면 끝',
    note: '화식 비율·배송일 변경, 일시정지와 해지 모두 앱에서 해요',
    badges: [
      { kind: 'chip', text: '언제든 일시정지', tone: 'accent', side: 'left', top: '6%' },
      { kind: 'photo', src: '/pkg/pork.webp', side: 'right', top: '27%' },
    ],
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg, #FAF7F2)', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
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
                background: i === idx ? 'var(--terracotta, #C86B45)' : 'rgba(60,40,26,0.22)',
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
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 'max(44px, calc(env(safe-area-inset-top) + 30px))',
              paddingBottom: 'calc(18px + env(safe-area-inset-bottom))',
            }}
          >
            {/* 흰 패널 — 헤드라인 + 폰. 아래 모서리가 폰을 자른다. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: '#fff',
                borderRadius: '0 0 30px 30px',
                boxShadow: '0 18px 40px -30px rgba(60,40,26,0.5)',
              }}
            >
              <h1
                style={{
                  flexShrink: 0,
                  margin: 0,
                  padding: '26px 22px 0',
                  fontSize: 22,
                  lineHeight: 1.34,
                  letterSpacing: '-0.035em',
                  textAlign: 'center',
                }}
              >
                <span style={{ display: 'block', fontWeight: 700, color: '#5A4A3A' }}>{s.lead}</span>
                <span style={{ display: 'block', fontWeight: 800, color: 'var(--ink, #2A1F16)' }}>{s.punch}</span>
              </h1>

              <PhoneStage slide={s} eager={i === 0} />
            </div>

            <div style={{ flexShrink: 0, padding: '16px 22px 0' }}>
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  textAlign: 'center',
                  color: 'var(--muted, #7A6A58)',
                  fontWeight: 500,
                }}
              >
                {s.note}
              </p>
              {i < LAST ? (
                <button type="button" onClick={() => goTo(i + 1)} style={btnPrimary}>
                  다음
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <button type="button" onClick={() => complete('/start')} style={btnPrimary}>
                    무료로 시작하기
                  </button>
                  <button
                    type="button"
                    onClick={() => complete('/login')}
                    style={{
                      width: '100%',
                      height: 46,
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
  height: 52,
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
 * 폰은 **높이 기준**으로 키워 스테이지보다 크게 만든다(height:116%). 그래야
 * 화면 폭과 무관하게 항상 아래로 잘려 나가고, 잘린 자리는 흰 패널의 둥근 아래
 * 모서리가 받아 준다. 폭 기준으로 잡으면 긴 화면에서 바닥에 떠 그림자가 드러난다.
 */
function PhoneStage({ slide, eager }: { slide: Slide; eager: boolean }) {
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, marginTop: 16 }}>
      {/* ★loading="lazy" 금지 (실측): 안드로이드 WebView 에서 가로 캐러셀의
          2~4번째 장이 영영 로드되지 않는다(naturalWidth 0). 전부 eager. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 목업 이미지, next/image 이득 없음 */}
      <img
        src={slide.shot}
        alt=""
        fetchPriority={eager ? 'high' : 'low'}
        decoding="async"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '116%',
          width: 'auto',
          maxWidth: '94%',
        }}
      />
      {slide.badges.map((b) => (
        <BadgeView key={b.kind === 'chip' ? b.text : b.src} badge={b} />
      ))}
    </div>
  )
}

/**
 * 칩 = 기능 이름, 원형 = 제품 실사진. 손으로 그린 SVG 동그라미는 사장님이
 * "못생겼다"고 반려했으므로 도형으로 뭘 가리키지 않는다 — 배지는 그 자체로
 * 정보만 담고, 아이콘·이모지로 자리를 때우지 않는다.
 */
function BadgeView({ badge }: { badge: Badge }) {
  const anchor: React.CSSProperties = {
    position: 'absolute',
    top: badge.top,
    ...(badge.side === 'left' ? { left: '2%' } : { right: '2%' }),
    zIndex: 3,
  }

  if (badge.kind === 'photo') {
    return (
      <div
        style={{
          ...anchor,
          width: 76,
          height: 76,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '4px solid #fff',
          boxShadow: '0 14px 26px -10px rgba(60,40,26,0.45)',
          background: '#fff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 정사각 자산, CSS 가 원형을 만든다 */}
        <img
          src={badge.src}
          alt=""
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  const accent = badge.tone === 'accent'
  return (
    <span
      style={{
        ...anchor,
        display: 'inline-block',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        background: accent ? 'var(--terracotta, #C86B45)' : '#fff',
        color: accent ? '#fff' : 'var(--ink, #2A1F16)',
        border: accent ? 'none' : '1px solid #EFE7DA',
        boxShadow: accent ? '0 12px 24px -10px rgba(200,107,69,0.6)' : '0 12px 24px -10px rgba(60,40,26,0.4)',
      }}
    >
      {badge.text}
    </span>
  )
}
