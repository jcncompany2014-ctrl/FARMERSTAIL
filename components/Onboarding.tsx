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
 * "이 앱으로 뭘 하나"를 보여준다. 순서(사장님 지정):
 * ①홈 ②맞춤 분석 ③수의사 보고서 ④구독 관리(+CTA).
 * 건강 일지 장은 사장님 지시로 뺐고, 그 자리를 실제 홈 화면이 대신한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markOnboarded } from '@/lib/onboarding'

type Slide = {
  shot: string
  lead: string
  punch: string
  note: string
}

/**
 * ⚠️ 스크린샷을 확대해서 자산의 빈 아래를 밀어내려다 실패했다(2026-09-08 실측).
 * 자산 비율 = 화면 비율(9/19)이라 **어떤 확대든 좌우를 잘라 먹는다** — 구독
 * 카드의 금액·버튼 글자가 양옆으로 잘려 나갔다. 파일 아래 SHOT_ASPECT 주석의
 * 경고와 같은 함정이다. 빈 아래를 채우려면 확대가 아니라 **자산을 다시 찍어야**
 * 한다(scratchpad/shoot-onboarding.mjs).
 */

/**
 * ★배지(칩·원형 사진) 전면 제거 — 2026-09-08 사장님 지시("버튼같이 설명하는
 *  거, 스티커 느낌이 짜친다").
 *
 * 실물에서 확인된 문제 셋:
 *  ① 칩이 하단 CTA 와 **같은 옷**(테라코타 알약+그림자+800)이라 누를 수 있는
 *     줄 안다. 화면에서 제일 중요한 '다음' 버튼과 위계가 붙어버렸다.
 *  ② 스크린샷 내용을 가린다 — '여러 마리 전환' 칩이 정작 그 드롭다운을 덮었다.
 *  ③ 화면에 이미 보이는 걸 또 말한다(드롭다운이 열려 있는데 "여러 마리 전환").
 *     헤드라인·칩·설명문이 같은 말을 세 번 했다.
 *
 * 대신 **헤드라인이 직접 숫자를 말한다.** 이 제품의 무기는 강아지마다 다르게
 * 나오는 그램·kcal 이고, 스크린샷은 그 숫자의 증거로 뒤에 선다. 스티커로
 * 강조를 만들지 않고 타이포 위계(lead 작게·punch 크게)로 만든다.
 * 숫자는 반드시 **자산에 실제로 보이는 값**과 일치시킨다 — 헤드라인이 65g 인데
 * 화면이 다른 숫자면 그 순간 신뢰가 깨진다.
 */
const SLIDES: Slide[] = [
  {
    shot: '/onboarding/app-home.webp',
    lead: '오늘 코코가 먹을 양은',
    punch: '화식 65g',
    note: '체중과 활동량으로 계산해서, 앱을 열면 오늘 먹일 양이 바로 떠요',
  },
  {
    shot: '/onboarding/app-analysis.webp',
    lead: '4.2kg 푸들 코코에게 필요한 건',
    punch: '하루 288kcal',
    note: '체형·건강·기호를 넣으면 필요 열량과 급여량을 그램 단위로 계산해요',
  },
  {
    shot: '/onboarding/app-vet.webp',
    lead: '병원 갈 때는',
    punch: '종이 한 장이면 끝',
    note: '12개월 체중 추이·식이·분석을 A4 한 장으로 정리해 드려요',
  },
  {
    // 규칙31 — "언제든 해지/일시정지"는 과약속. 마감(다음 결제 전)을 명시한다.
    shot: '/onboarding/app-subscription.webp',
    lead: '레시피도 배송일도',
    punch: '다음 결제 전까지 변경',
    note: '화식 비율·배송일 변경, 일시정지와 해지 모두 앱에서 해요',
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
              {/* ★위계 = 타이포로 만든다(2026-09-08). 예전엔 두 줄이 **같은 22px**
                  이고 굵기만 달라 강약이 없었다 — 그 빈 자리를 스티커 칩이 대신
                  메우고 있었다. 조건줄은 작고 연하게, 결과줄은 크고 진하게. */}
              <h1
                style={{
                  flexShrink: 0,
                  margin: 0,
                  padding: '24px 22px 0',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: 14.5,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: '-0.02em',
                    color: 'var(--muted, #7A6A58)',
                  }}
                >
                  {s.lead}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    fontSize: 30,
                    fontWeight: 800,
                    lineHeight: 1.22,
                    letterSpacing: '-0.045em',
                    color: 'var(--ink, #2A1F16)',
                  }}
                >
                  {s.punch}
                </span>
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
 * 비율(SHOT_ASPECT)과 어긋나고, object-fit:cover 가 그 차이를 **좌우를 잘라서**
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
          // 아주 좁고 긴 화면(세로/가로 비 > 약 1.56)에서만 걸리는 안전장치.
          // 걸리면 폭이 잘려 aspect-ratio 가 무시되고 cover 가 좌우를 조금 자른다 —
          // 슬라이드 밖으로 폰이 삐져나가는 것보다는 낫다는 판단.
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
      </div>
    </div>
  )
}
