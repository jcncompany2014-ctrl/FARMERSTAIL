/**
 * BrandLoader — 파머스테일 도장 기반 로딩 화면.
 *
 * 라우트 전환·서버 fetch 중 Suspense fallback (loading.tsx) 으로 노출된다.
 * 헤더/탭바는 layout 에 남고 본문 영역만 이걸로 교체된다.
 *
 * ★2026-10-08 앱 첫 실행 로딩(AppSplash — 꼬리 흔드는 도장 + 점 3개)과 같은 도장·같은 점으로 맞췄다
 * (사장님 "로딩 한 번으로"). 예전엔 헤더 워드마크(/logo-ink.png)라 앱을 켤 때 본 도장과 다른 그림이었다.
 * 여기선 영상 대신 정지 도장이 은은하게 숨쉰다 — 화면 이동마다 영상 디코더를 띄울 일은 아니다.
 * 도장 그림은 크림 바탕이 칠해진 정사각형이라 둥글게 오려(마스크) 페이지 바탕 위에 도장만 남긴다.
 *
 * 모션은 globals.css 의 `ft-splash-breathe` + `ft-splash-dot` 키프레임 —
 * prefers-reduced-motion 시 전역 가드로 정적이 된다(접근성).
 *
 * @example app/(main)/loading.tsx
 *   import BrandLoader from '@/components/v3/BrandLoader'
 *   export default function Loading() {
 *     return <BrandLoader />
 *   }
 */
import { SPLASH_STILL_SRC } from '@/components/AppSplash'

interface BrandLoaderProps {
  /** 스크린리더용 안내 문구. 기본 '불러오는 중'. */
  label?: string
  /** 세로 중앙정렬 영역 높이. 기본 '70vh'. */
  minHeight?: string | number
}

/** 도장 잉크색 — 점 색. globals.css .ft-splash__dots 와 같은 값. */
const STAMP_INK = '#6D3C32'
const STAMP_SIZE = 92

export default function BrandLoader({
  label = '불러오는 중',
  // 로고가 너무 아래 느낌 → 컨테이너 높이 낮춰 살짝 위로(사장님 2026-07-13).
  minHeight = '55vh',
}: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: 20,
      }}
    >
      {/* 도장 — 둥근 마스크로 그림의 크림 네모를 지우고 도장만. 2.4s 숨쉬기. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SPLASH_STILL_SRC}
        alt=""
        width={STAMP_SIZE}
        height={STAMP_SIZE}
        style={{
          width: STAMP_SIZE,
          height: STAMP_SIZE,
          WebkitMaskImage: 'radial-gradient(circle closest-side, #000 96.5%, transparent 98%)',
          maskImage: 'radial-gradient(circle closest-side, #000 96.5%, transparent 98%)',
          animation: 'ft-splash-breathe 2.4s ease-in-out infinite',
        }}
      />

      {/* 점 3개 — 앱 첫 실행 로딩과 같은 모션·색. */}
      <div style={{ display: 'flex', gap: 8 }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: STAMP_INK,
              animation: 'ft-splash-dot 1s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      {/* 시각적으로는 숨기고 스크린리더에만 읽힘. */}
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {label}
      </span>
    </div>
  )
}
