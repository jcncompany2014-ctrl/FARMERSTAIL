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
 * 에뮬레이터에서 실촬영한 앱 화면 `public/onboarding/app-*.webp` 를 **그대로**
 * 쓴다. 기기 프레임은 사진이 아니라 CSS 다(PhoneStage 주석 참조).
 * ⚠️ 화면 내용·폰트를 **AI 로 다시 그리지 않는다** — 한글이 뭉개진다.
 * UI 가 바뀌면 다시 찍어 같은 파일명으로 덮으면 끝이다.
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
    shot: '/onboarding/app-home.webp',
    lead: '우리 아이 하루가',
    punch: '앱 하나에 모여요',
    note: '오늘 급여량·기록·다음 배송일까지 한 화면에서 봐요',
    badges: [
      // top 값은 **화면(스크린샷) 높이 기준 비율**이다. 가리키려는 UI 가 스크린샷
      // 세로 어디쯤인지 재서 맞춘다 — 감으로 잡으면 강아지 얼굴을 덮는다(실제로 덮었다).
      { kind: 'chip', text: '여러 마리 전환', tone: 'plain', side: 'right', top: '8%' },
      { kind: 'chip', text: '오늘 급여량', tone: 'accent', side: 'left', top: '45%' },
    ],
  },
  {
    shot: '/onboarding/app-analysis.webp',
    lead: '체형·건강·기호를 넣으면',
    punch: '맞춤 레시피가 나와요',
    note: '필요한 열량과 하루 급여량까지 그램 단위로 계산해요',
    badges: [
      { kind: 'photo', src: '/bowl/chicken.webp', side: 'right', top: '18%' },
      { kind: 'chip', text: '그램 단위 급여량', tone: 'accent', side: 'left', top: '44%' },
    ],
  },
  {
    shot: '/onboarding/app-vet.webp',
    lead: '병원 갈 때는',
    punch: '종이 한 장이면 끝나요',
    note: '12개월 체중 추이·식이·분석을 A4 한 장으로 정리해 드려요',
    badges: [
      { kind: 'chip', text: 'PDF 저장', tone: 'plain', side: 'right', top: '8%' },
      { kind: 'chip', text: '12개월 체중 추이', tone: 'accent', side: 'left', top: '48%' },
    ],
  },
  {
    shot: '/onboarding/app-subscription.webp',
    lead: '바꾸고 미루는 것까지',
    punch: '앱에서 몇 번이면 끝',
    note: '화식 비율·배송일 변경, 일시정지와 해지 모두 앱에서 해요',
    badges: [
      // 규칙31 — "언제든 해지/일시정지"는 과약속. 마감을 명시하거나 중립 표기.
      { kind: 'chip', text: '2주 미루기·일시정지', tone: 'accent', side: 'left', top: '42%' },
      // 구독 카드 아래가 비어 보여서, 그 자리를 파우치 사진이 채우게 내렸다.
      { kind: 'photo', src: '/pkg/pork.webp', side: 'right', top: '62%' },
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
 * 베젤은 **패딩이 아니라 바깥 링**(box-shadow spread)으로 그린다.
 *
 * 패딩으로 그리면 안쪽 화면 비율이 `(W-2·베젤)/(H-2·베젤)` 이 되어 스크린샷
 * 비율(720:1600)과 어긋나고, object-fit:cover 가 그 차이를 **좌우를 잘라서**
 * 메운다(실측 한쪽 3.5%씩). 링으로 그리면 요소 자체가 곧 화면이라 비율이
 * 정확히 일치해 잘림이 0 이고, 베젤 바깥 모서리는 `SCREEN_RADIUS + BEZEL` 로
 * 자동으로 따라온다 — 모서리가 어색했던 원인이 여기였다.
 */
const BEZEL = 7
const SCREEN_RADIUS = 35
/**
 * 스크린샷 비율 — `app-*.webp` 는 전부 720×1520.
 * 원본 1080×2400 에서 **안드로이드 상태바(시계·와이파이·배터리) 위 120px 을
 * 잘라낸** 크기다(사장님 지시). 자산을 다시 만들 때 크롭 값을 바꾸면 이 비율도
 * 같이 고쳐야 한다 — 어긋나면 object-fit:cover 가 좌우를 잘라 먹는다.
 */
const SHOT_ASPECT = '9 / 19'

/**
 * 기기는 **CSS 로 그린다**(생성 목업 사진 폐기, 2026-08-26 사장님 지시).
 *
 * 사진 목업은 세 가지가 동시에 틀어졌다 — ① 화면 모서리 곡률이 스크린샷과 안
 * 맞아 어색했고 ② 목업 사진 자체의 배경이 폰 주위에 네모로 남았고 ③ 배지를
 * 폰이 아니라 슬라이드 기준으로 붙여 위치가 제멋대로였다. 프레임을 코드로
 * 그리면 셋 다 사라진다 — 모서리는 같은 상수에서 나오고, 배경은 아예 없으며,
 * 배지는 프레임의 자식이라 항상 기기 가장자리에 붙는다.
 *
 * 크기는 `height:114%` 로 **높이를 확정**하고 폭은 `aspect-ratio` 가 만든다.
 * 그래야 화면이 길든 짧든 폰이 항상 흰 패널 아래로 잘려 나간다 — 폭 기준으로
 * 잡으면 긴 화면에서 폰이 바닥에 떠 그림자 선이 드러난다.
 */
function PhoneStage({ slide, eager }: { slide: Slide; eager: boolean }) {
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, marginTop: 16 }}>
      {/* 기기 = 화면 크기 그 자체. 높이를 확정하고 폭은 비율에서 나온다. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          height: '114%',
          aspectRatio: SHOT_ASPECT,
          maxWidth: '84%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {/* 화면 — overflow 로 자르되 배지는 형제라 잘리지 않는다. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: SCREEN_RADIUS,
            overflow: 'hidden',
            background: '#F4EFE7',
            // 흰 베젤이 흰 패널에 묻히지 않도록 테두리 실선을 또렷하게 준다.
            boxShadow: `0 0 0 ${BEZEL}px #FFFFFF, 0 0 0 ${BEZEL + 1}px rgba(60,40,26,0.20), 0 22px 42px -18px rgba(60,40,26,0.5), 0 4px 10px -4px rgba(60,40,26,0.18)`,
          }}
        >
          {/* ★loading="lazy" 금지 (실측): 안드로이드 WebView 에서 가로 캐러셀의
              2~4번째 장이 영영 로드되지 않는다(naturalWidth 0). 전부 eager. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 화면 스크린샷, next/image 이득 없음 */}
          <img
            src={slide.shot}
            alt=""
            fetchPriority={eager ? 'high' : 'low'}
            decoding="async"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
          />
        </div>
        {slide.badges.map((b) => (
          <BadgeView key={b.kind === 'chip' ? b.text : b.src} badge={b} />
        ))}
      </div>
    </div>
  )
}

/**
 * 칩 = 기능 이름, 원형 = 제품 실사진. 손으로 그린 SVG 동그라미는 사장님이
 * "못생겼다"고 반려했으므로 도형으로 뭘 가리키지 않는다 — 배지는 그 자체로
 * 정보만 담고, 아이콘·이모지로 자리를 때우지 않는다.
 */
function BadgeView({ badge }: { badge: Badge }) {
  // 기준은 **화면** 가장자리다. 베젤 링(BEZEL)이 그 바깥에 그려지므로 링을
  // 넘어 걸쳐 보이려면 오프셋이 BEZEL 보다 커야 한다.
  const overhang = badge.kind === 'photo' ? -(BEZEL + 22) : -(BEZEL + 11)
  const anchor: React.CSSProperties = {
    position: 'absolute',
    top: badge.top,
    ...(badge.side === 'left' ? { left: overhang } : { right: overhang }),
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
