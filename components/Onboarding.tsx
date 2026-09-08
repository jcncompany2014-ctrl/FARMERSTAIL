'use client'

/**
 * Farmer's Tail — 첫 설치 온보딩.
 *
 * # 레이아웃 정본 (2026-09-08 사장님 레퍼런스: CAZZLE·아이클릭아트)
 *   ① **채도 있는 그라데이션 배경** 위에 흰 헤드라인 — 예전의 베이지 배경 +
 *      흰 패널 조합은 전부 평평해 보였다.
 *   ② 큰 두 줄 헤드라인 — 조건줄 작고 연하게, 결과줄 크고 진하게. 결과줄은
 *      **구체적 숫자**를 말하고(화식 210g / 하루 288kcal) 스크린샷이 그걸 증명한다.
 *   ③ 폰이 아래로 잘려 나간다 — 여백 안에 얌전히 들어가면 작아 보인다.
 *   ④ 폰 가장자리에 걸친 **유리 카드** 배지. 알약(pill) 금지 — CTA 버튼과 같은
 *      옷이 되어 "버튼같이 설명하는 거"로 읽힌다(사장님 반려). 카드는 폰 밖으로
 *      크게 빼서 스크린샷 내용을 가리지 않는다.
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
import {
  Bell,
  CalendarClock,
  CalendarDays,
  FileDown,
  PauseCircle,
  PawPrint,
  Scale,
  ShieldCheck,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { markOnboarded } from '@/lib/onboarding'

/**
 * 폰 가장자리에 걸치는 유리 카드. top 은 **화면(스크린샷) 높이 기준 비율**.
 * icon 은 lucide 아이콘 — 브랜드색 원 안에 흰 아이콘으로 앞에 세운다
 * (2026-09-08 사장님 레퍼런스: 반투명 카드 + 앞에 컬러 아이콘).
 */
type Badge = {
  text: string
  side: 'left' | 'right'
  top: string
  Icon: LucideIcon
}

type Slide = {
  shot: string
  lead: string
  punch: string
  note: string
  badges: Badge[]
  /**
   * 폰 화면 위에 겹쳐 그리는 **푸시 알림 카드**(2026-09-08 사장님 요청).
   * 문구는 실제로 나가는 알림과 같은 형식이다 —
   * `app/api/cron/weight-change-detect/route.ts` 의 title/body.
   * 없는 기능을 그림으로 약속하지 않기 위해 그 파일이 정본이다.
   */
  notify?: { title: string; body: string }
}

/**
 * ⚠️ 스크린샷을 확대해서 자산의 빈 아래를 밀어내려다 실패했다(2026-09-08 실측).
 * 자산 비율 = 화면 비율(9/19)이라 **어떤 확대든 좌우를 잘라 먹는다** — 구독
 * 카드의 금액·버튼 글자가 양옆으로 잘려 나갔다. 파일 아래 SHOT_ASPECT 주석의
 * 경고와 같은 함정이다. 빈 아래를 채우려면 확대가 아니라 **자산을 다시 찍어야**
 * 한다(scratchpad/shoot-onboarding.mjs).
 */

/**
 * ★배지는 **유리 카드**로만 쓴다 (2026-09-08 두 차례 수정).
 *
 * 1차: 테라코타 알약 칩 → 사장님 반려("버튼같이 설명하는 거 / 스티커 느낌").
 *   실제 문제는 ①CTA 와 같은 옷이라 눌리는 줄 알고 ②가리키려던 UI 를 덮고
 *   ③화면에 보이는 걸 또 말한 것이었다.
 * 2차: 전부 제거 → 레퍼런스(CAZZLE)를 받고 **형태를 바꿔 재도입**. 배지 자체가
 *   문제가 아니라 알약 모양이 문제였다.
 *
 * 헤드라인은 계속 **자산에 실제로 보이는 숫자**를 말한다(65 G / 288 kcal).
 * 자산을 다시 찍으면 헤드라인 숫자도 함께 고친다.
 */
const SLIDES: Slide[] = [
  {
    shot: '/onboarding/app-home.webp',
    lead: '오늘 푸린이가 먹을 양은',
    punch: '화식 210g',
    note: '먹일 양을 그램까지 계산하고, 그 양 그대로 소분 포장해 보내드려요',
    badges: [
      { text: '오늘 급여량', side: 'left', top: '78%', Icon: UtensilsCrossed },
      { text: '여러 마리 관리', side: 'right', top: '33%', Icon: PawPrint },
    ],
  },
  {
    shot: '/onboarding/app-analysis.webp',
    lead: '4.3kg 푸들 푸린이에게 필요한 건',
    punch: '하루 288kcal',
    note: '체형·건강·기호를 넣으면 필요 열량과 급여량을 그램 단위로 계산해요',
    badges: [
      { text: '그램 단위 계산', side: 'right', top: '20%', Icon: Scale },
      { text: '국제 기준 충족', side: 'left', top: '89%', Icon: ShieldCheck },
    ],
  },
  {
    // 홈 화면 자산을 재사용하고 그 위에 알림 카드를 얹는다 — 알림은 원래
    // 앱을 안 보고 있을 때 오는 것이라 별도 촬영본이 필요 없다.
    shot: '/onboarding/app-home.webp',
    lead: '체중만 기록해두면',
    punch: '다음 박스가 달라져요',
    note: '4주마다 변화를 확인해서, 먹일 열량을 다시 계산해 알려드려요',
    notify: {
      title: '푸린이가 체중 +5.2% 증가',
      body: '4주 만에 변화가 있었네요. 하루 급여 열량을 288→270kcal로 조정을 제안드려요.',
    },
    badges: [
      { text: '4주마다 확인', side: 'left', top: '62%', Icon: CalendarClock },
      { text: '열량 재계산', side: 'right', top: '78%', Icon: TrendingUp },
    ],
  },
  {
    shot: '/onboarding/app-vet.webp',
    lead: '병원 갈 때는',
    punch: '종이 한 장이면 끝',
    note: '12개월 체중 추이·식이·분석을 A4 한 장으로 정리해 드려요',
    badges: [
      { text: '12개월 요약', side: 'left', top: '41%', Icon: CalendarDays },
      { text: 'PDF 저장', side: 'right', top: '62%', Icon: FileDown },
    ],
  },
  {
    // 규칙31 — "언제든 해지/일시정지"는 과약속. 마감(다음 결제 전)을 명시한다.
    shot: '/onboarding/app-subscription.webp',
    lead: '레시피도 배송일도',
    punch: '다음 결제 전까지 변경',
    note: '봉지만 뜯어 그대로 주면 끝 — 계량도 남는 양 고민도 없어요',
    // 이 자산은 아래 절반이 비어 있다 — 배지를 그 자리에 내려 균형을 맞춘다.
    badges: [
      { text: '배송일 변경', side: 'left', top: '38%', Icon: Truck },
      { text: '일시정지', side: 'right', top: '60%', Icon: PauseCircle },
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
    /**
     * ★배경 = 브랜드 그라데이션(2026-09-08 사장님 레퍼런스: CAZZLE·아이클릭아트).
     * 그 둘의 공통 문법은 ①채도 있는 그라데이션 위에 ②큰 흰 헤드라인 ③그 위에
     * 떠 있는 폰과 유리 카드다. 우리는 베이지 배경 + 흰 패널이라 전부 평평했다.
     * 색은 레퍼런스의 보라가 아니라 **우리 강조색(테라코타)** 으로 번역한다 —
     * 음식 브랜드에 보라는 남의 옷이고, 앱 CTA 색과도 이어진다.
     * 위쪽 방사형 광은 폰이 놓일 자리에 빛을 모아 입체감을 만든다.
     */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflow: 'hidden',
        background:
          // 상단을 한 단계 진하게(#E08A5F→#CE7549) — 흰 헤드라인이 밝은 주황
          // 위에서 흐려 보인다는 지적(2026-09-08)의 절반은 배경 대비 문제였다.
          'radial-gradient(115% 75% at 50% 8%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 58%), linear-gradient(168deg, #CE7549 0%, #B85B39 44%, #8C3A21 100%)',
      }}
    >
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
              key={s.punch}
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
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.42)',
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
            color: 'rgba(255,255,255,0.82)',
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
            key={s.punch}
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
            {/* ★흰 패널 제거(2026-09-08) — 헤드라인·폰이 그라데이션 위에 바로
                놓인다. 패널이 있으면 배경색이 위아래 띠로만 남아 레퍼런스의
                "떠 있는" 느낌이 안 산다. 폰은 이 컨테이너 밖으로 잘려 나간다. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
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
                    color: 'rgba(255,255,255,0.94)',
                    textShadow: '0 1px 8px rgba(70,20,5,0.35)',
                  }}
                >
                  {s.lead}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 3,
                    // ★강조 강화(2026-09-08 사장님: "강조가 약하다 / 살짝 안
                    //   읽힌다"). 크기·굵기를 올리고 그림자를 **두 겹**으로 —
                    //   좁고 진한 그림자가 글자 가장자리를 배경에서 떼어내고,
                    //   넓고 옅은 그림자가 덩어리째 띄운다.
                    fontSize: 33,
                    fontWeight: 900,
                    lineHeight: 1.18,
                    letterSpacing: '-0.05em',
                    color: '#fff',
                    textShadow:
                      '0 1px 3px rgba(70,18,4,0.5), 0 6px 24px rgba(70,18,4,0.4)',
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
                  // ★여기가 제품의 약속을 말하는 자리다(2026-09-08 사장님:
                  //   "먹는 양을 정확하게, 보호자가 안 귀찮게 포장해서 준다를
                  //   다음 버튼 위 작은 글씨에 강조"). 보조 설명이 아니라
                  //   두 번째 헤드라인처럼 읽히도록 크기·굵기·대비를 올린다.
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  textAlign: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  textShadow: '0 1px 10px rgba(70,20,5,0.4)',
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
                      border: '1.5px solid rgba(255,255,255,0.55)',
                      background: 'transparent',
                      color: '#fff',
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

/**
 * 배경이 테라코타가 됐으므로 CTA 는 **반전**한다 — 흰 알약 + 테라코타 글씨.
 * 같은 색 위에 같은 색 버튼을 두면 묻힌다(레퍼런스 둘 다 배경 대비 버튼).
 */
const btnPrimary: React.CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 999,
  border: 'none',
  background: '#fff',
  color: '#A8462A',
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  boxShadow: '0 14px 30px -12px rgba(60,20,8,0.5)',
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
/**
 * ★베젤은 얇고 **어둡게**(2026-09-08 사장님: "그림자 좀 넣어서 구분감, 아주
 * 얇은 베젤"). 예전 7px 흰 링은 **흰 패널 위에서 묻히지 않으려던 것**인데,
 * 패널이 사라지고 배경이 테라코타가 되면서 오히려 굵고 허옇게 튀었다.
 * 실제 기기처럼 어두운 테를 얇게 두르면 배경에서 또렷이 떨어지고,
 * 바깥의 흰 실선 한 겹이 그 테를 배경에서 한 번 더 분리한다.
 */
const BEZEL = 4
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
            boxShadow: [
              `0 0 0 ${BEZEL}px #241A12`, // 기기 테 — 얇고 어둡게
              `0 0 0 ${BEZEL + 1.5}px rgba(255,255,255,0.22)`, // 테를 배경에서 떼는 실선
              '0 34px 64px -22px rgba(48,14,3,0.72)', // 바닥에 떨어지는 큰 그림자
              '0 12px 26px -10px rgba(48,14,3,0.45)', // 가까운 그림자(접지감)
            ].join(', '),
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
        {slide.notify && <NotifyCard notify={slide.notify} />}
        {slide.badges.map((b) => (
          <BadgeCard key={b.text} badge={b} />
        ))}
      </div>
    </div>
  )
}

/**
 * 유리 카드 배지 (2026-09-08 재설계).
 *
 * 앞선 버전은 **테라코타 알약**이라 하단 CTA 와 같은 옷이었고, 사장님이
 * "버튼같이 설명하는 거 / 스티커 느낌"이라고 반려했다. 레퍼런스(CAZZLE)의
 * 배지는 알약이 아니라 **모서리 둥근 흰 유리 카드**다 — 버튼과 형태가 달라
 * 눌리는 것으로 오해되지 않고, 컬러 배경 위에서 떠 보인다.
 *
 * 폰 **바깥쪽으로 크게 빼서**(카드 폭의 절반 이상이 화면 밖) 스크린샷 내용을
 * 가리지 않는다 — 이전 버전이 정작 가리키려던 드롭다운을 덮었던 실수를 막는다.
 */
/**
 * 푸시 알림 카드 — 폰 화면 위에 실제 알림처럼 겹쳐 그린다(사장님 레퍼런스).
 *
 * 스크린샷을 다시 찍지 않고 CSS 로 그리는 이유: 알림은 **앱 밖에서** 오는 것이라
 * 앱 화면 촬영본에 담기지 않는다. 문구는 실제 발송 문구와 같은 형식을 쓴다
 * (weight-change-detect 크론) — 여기서 지어내면 없는 기능을 약속하게 된다.
 */
function NotifyCard({ notify }: { notify: NonNullable<Slide['notify']> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '9%',
        left: '4%',
        right: '4%',
        zIndex: 4,
        display: 'flex',
        gap: 10,
        padding: '12px 13px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.86)',
        border: '1px solid rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px) saturate(150%)',
        WebkitBackdropFilter: 'blur(16px) saturate(150%)',
        boxShadow:
          '0 22px 40px -16px rgba(48,14,3,0.6), 0 4px 12px -4px rgba(48,14,3,0.3)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 10,
          background: 'var(--terracotta, #C86B45)',
          color: '#fff',
          boxShadow: '0 5px 12px -4px rgba(200,107,69,0.75)',
        }}
      >
        <Bell size={16} strokeWidth={2.6} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink, #2A1F16)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notify.title}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8A7768', flexShrink: 0 }}>
            방금
          </span>
        </div>
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 11.5,
            lineHeight: 1.45,
            letterSpacing: '-0.02em',
            color: '#5A4A3A',
            wordBreak: 'keep-all',
          }}
        >
          {notify.body}
        </p>
      </div>
    </div>
  )
}

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: badge.top,
        // ★"따로 논다"의 원인은 배지가 폰 **바깥 허공**에 떠 있던 것이다
        //   (2026-09-08). 기기 테 위로 절반쯤 올라타야 "폰에 붙은 라벨"로
        //   읽힌다. 그림자도 폰과 같은 방향·같은 갈색 계열로 맞춰 한 덩어리로
        //   보이게 하고, 흰 테두리 한 겹으로 화면 위에서도 경계를 유지한다.
        // 오프셋은 폰 좌우 여백(≈47px) 안에서만 키울 수 있다 — 더 빼면 슬라이드
        // 밖으로 잘린다. 32px 면 배지의 1/3 이 밖, 2/3 가 기기 위에 걸친다.
        ...(badge.side === 'left' ? { left: -(BEZEL + 32) } : { right: -(BEZEL + 32) }),
        zIndex: 3,
        // ★반투명 유리 + 앞에 브랜드색 아이콘(2026-09-08 사장님 레퍼런스).
        //   불투명 흰 카드는 스크린샷 위에 종이를 덧댄 것처럼 보였다 — 살짝
        //   비쳐야 "화면 위에 뜬 라벨"로 읽힌다. blur 를 크게 줘야 비침이
        //   지저분해지지 않는다.
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 15px 8px 8px',
        borderRadius: 15,
        background: 'rgba(255,255,255,0.74)',
        border: '1px solid rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        color: 'var(--ink, #2A1F16)',
        boxShadow:
          '0 18px 30px -14px rgba(48,14,3,0.55), 0 4px 10px -3px rgba(48,14,3,0.3)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 27,
          height: 27,
          borderRadius: 9,
          flexShrink: 0,
          background: 'var(--terracotta, #C86B45)',
          color: '#fff',
          boxShadow: '0 4px 10px -3px rgba(200,107,69,0.7)',
        }}
      >
        <badge.Icon size={15} strokeWidth={2.6} />
      </span>
      {badge.text}
    </span>
  )
}
