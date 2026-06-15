/**
 * BrandLoader — 파머스테일 로고(워드마크) 기반 로딩 화면.
 *
 * 라우트 전환·서버 fetch 중 Suspense fallback (loading.tsx) 으로 노출된다.
 * 상단 헤더와 동일한 `/logo.png` 가 은은하게 숨쉬고(opacity+scale), 아래
 * 점 3개가 순차로 깜빡여 '살아있는' 로딩 느낌을 준다. 헤더/탭바는 layout 에
 * 남고 본문 영역만 이걸로 교체되므로 '앱 스플래시'처럼 자연스럽다.
 *
 * 모션은 globals.css 의 `ft-brand-breathe` + `pulse-soft` 키프레임 사용 —
 * prefers-reduced-motion 시 전역 가드로 정적이 된다(접근성).
 *
 * @example app/(main)/loading.tsx
 *   import BrandLoader from '@/components/v3/BrandLoader'
 *   export default function Loading() {
 *     return <BrandLoader />
 *   }
 */
import { V3 } from '@/lib/design/tokens'

interface BrandLoaderProps {
  /** 스크린리더용 안내 문구. 기본 '불러오는 중'. */
  label?: string
  /** 세로 중앙정렬 영역 높이. 기본 '70vh'. */
  minHeight?: string | number
}

export default function BrandLoader({
  label = '불러오는 중',
  minHeight = '70vh',
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
        gap: 18,
        padding: 20,
      }}
    >
      {/* 헤더와 동일한 워드마크 로고. brightness(0) 로 ink 톤(다크모드는
          --logo-filter override). 1.6s 숨쉬기. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-brush.png"
        alt="Farmer's Tail"
        width={150}
        style={{
          width: 150,
          height: 'auto',
          filter: 'none',
          animation: 'ft-brand-breathe 1.6s ease-in-out infinite',
        }}
      />

      {/* 점 3개 — 순차 깜빡임(스태거). */}
      <div style={{ display: 'flex', gap: 6 }} aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: V3.accent,
              animation: 'pulse-soft 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
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
