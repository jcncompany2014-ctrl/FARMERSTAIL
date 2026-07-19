'use client'

/**
 * Farmer's Tail — 첫 설치 온보딩 (2026-07-19 전면 리디자인, 사장님 "아예 새로 이쁘게").
 *
 * 옛 6슬라이드(종이톤 플레이스홀더 타일)를 폐기하고 **풀블리드 이미지 캐러셀**
 * 4장으로. 이미지는 Higgsfield 생성(브랜드 톤: 강아지+신선 화식). 각 슬라이드
 * = 전면 사진 + 하단 그라데이션 + 카피, 마지막 슬라이드에 CTA. 가로 스크롤-스냅
 * 스와이프 + 상단 진행 점 + 건너뛰기.
 *
 * OnboardingGate 가 첫 설치(standalone) 1회만 /welcome 으로 보내고, 이 컴포넌트가
 * 완료/스킵 시 markOnboarded() 후 /start(앱 설문) 또는 /login 으로 이동한다.
 * position:fixed 전체화면 takeover — 어떤 chrome 위에도 덮인다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markOnboarded } from '@/lib/onboarding'

type Slide = {
  img: string
  kicker: string
  title: string
  sub: string
}

const SLIDES: Slide[] = [
  {
    img: '/onboarding/01-welcome.jpg',
    kicker: "FARMER'S TAIL",
    title: '우리 아이에게,\n진짜 밥을',
    sub: '수의영양 기준으로 만든\n신선 화식을 집으로.',
  },
  {
    img: '/onboarding/02-analysis.jpg',
    kicker: 'STEP 1 · 맞춤 분석',
    title: '2분이면,\n딱 맞는 식단',
    sub: '체형·건강·기호를 분석해\n우리 아이만을 위한 레시피를 찾아요.',
  },
  {
    img: '/onboarding/03-delivery.jpg',
    kicker: 'STEP 2 · 정기배송',
    title: '떨어질 때쯤,\n알아서 도착',
    sub: '2주마다 신선하게 만들어\n화요일에 문 앞으로 보내드려요.',
  },
  {
    img: '/onboarding/04-start.jpg',
    kicker: 'START',
    title: '이제,\n시작해요',
    sub: '우리 아이 맞춤 화식을\n지금 만나보세요.',
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

  // 뒤로가기(안드로이드 하드웨어/제스처)로 온보딩을 벗어나지 않게 — 첫 설치 흐름.
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
        background: '#171310',
        overflow: 'hidden',
      }}
    >
      {/* 상단 스크림 — 밝은 이미지 위에서도 흰 점·건너뛰기 가독. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 140,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(23,19,16,0.42), rgba(23,19,16,0))',
        }}
      />

      {/* 진행 점 + 건너뛰기 */}
      <div
        style={{
          position: 'absolute',
          top: 'max(14px, env(safe-area-inset-top))',
          left: 0,
          right: 0,
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
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
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
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
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 4px',
          }}
        >
          건너뛰기
        </button>
      </div>

      {/* 이미지 캐러셀 — 이미지만 스와이프(카피/버튼은 하단 고정) */}
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
        {SLIDES.map((s) => (
          <section
            key={s.img}
            style={{
              position: 'relative',
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.img}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </section>
        ))}
      </div>

      {/* 하단 그라데이션 — 카피/버튼 가독(이미지 위 고정) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '64%',
          zIndex: 3,
          pointerEvents: 'none',
          background:
            'linear-gradient(to top, rgba(23,19,16,0.95) 0%, rgba(23,19,16,0.86) 34%, rgba(23,19,16,0.4) 66%, rgba(23,19,16,0) 100%)',
        }}
      />

      {/* 하단 콘텐츠 — 카피 + 버튼을 한 컬럼으로(겹침 원천 차단). */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 4,
          padding: '0 24px calc(26px + env(safe-area-inset-bottom)) 24px',
        }}
      >
        {/* 카피 — idx 바뀌면 크로스페이드(key 재마운트). */}
        <div key={idx} className="animate-fade-in" style={{ marginBottom: 18 }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: '#E8B84B',
              textTransform: 'uppercase',
            }}
          >
            {SLIDES[idx]!.kicker}
          </span>
          <h1
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 32,
              lineHeight: 1.14,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#fff',
              whiteSpace: 'pre-line',
            }}
          >
            {SLIDES[idx]!.title}
          </h1>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 14.5,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.85)',
              whiteSpace: 'pre-line',
              fontWeight: 500,
            }}
          >
            {SLIDES[idx]!.sub}
          </p>
        </div>

        {/* 버튼 — 1~3: 다음 / 마지막: CTA 2개. 카피와 같은 컬럼이라 안 겹침. */}
        {idx < LAST ? (
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            style={{
              width: '100%',
              height: 56,
              borderRadius: 999,
              border: 'none',
              background: 'var(--terracotta, #C86B45)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 10px 28px -10px rgba(200,107,69,0.7)',
            }}
          >
            다음
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => complete('/start')}
              style={{
                width: '100%',
                height: 56,
                borderRadius: 999,
                border: 'none',
                background: 'var(--terracotta, #C86B45)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 10px 28px -10px rgba(200,107,69,0.7)',
              }}
            >
              무료로 시작하기
            </button>
            <button
              type="button"
              onClick={() => complete('/login')}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 999,
                border: '1.5px solid rgba(255,255,255,0.5)',
                background: 'transparent',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              이미 계정이 있어요
            </button>
            <p
              style={{
                margin: '4px 0 0',
                textAlign: 'center',
                fontSize: 11,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              계속 진행하면 이용약관·개인정보처리방침에 동의하게 됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
