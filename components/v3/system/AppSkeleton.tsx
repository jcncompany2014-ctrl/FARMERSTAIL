import type { CSSProperties, ReactNode } from 'react'
import { V3Radius } from '@/lib/design/tokens'

/**
 * 앱 '불러오는 중' 뼈대 부품 — 시안 B06(홈)·B07(우리 아이)·B08(내 정보) (2026-10-09 'A 포스터').
 *
 * 뼈대가 있는 이유는 다 불러왔을 때 화면이 덜컹 움직이지 않게 하는 것이다(결정: "불러오는 중 뼈대는
 * 새 홈 배치에 맞춤"). 그래서 화면마다 실제 새 배치를 본떠 loading.tsx 가 직접 짜고, 여기엔 공통 부품
 * 두 개만 둔다 — 회색 칸(SkeletonBlock)과 바깥 틀(AppSkeleton).
 *
 * 칸 색은 시안 값 #EFEDEE — 회색 면(V3.soft #F6F4F5)보다 한 단계 진해 흰 바탕에서 보이는 가장 옅은 회색.
 * 색이 있는 면(머스타드 박스 카드·옅은 주황 띠)은 뼈대에선 이 색의 테두리나 회색 면으로 그린다 — 색이
 * 먼저 뜨면 다 그려진 화면처럼 보인다. 숨쉬기(옅어졌다 돌아옴)는 움직임 줄이기 설정이면 멈춘다(motion-safe).
 */

/** 뼈대 칸·테두리 색(시안 B06~B08). */
export const SKELETON_FILL = '#EFEDEE'

export function SkeletonBlock({
  width,
  height,
  round = false,
  style,
}: {
  width: number | string
  height: number | string
  /** true = 동그라미(사진 자리). */
  round?: boolean
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        width,
        height,
        flexShrink: 0,
        borderRadius: round ? 999 : V3Radius.sm,
        background: SKELETON_FILL,
        ...style,
      }}
    />
  )
}

/** 뼈대 바깥 틀 — 화면 읽기 프로그램엔 '불러오는 중' 한 마디만 들린다(칸들은 전부 숨김). */
export default function AppSkeleton({ children, label = '불러오는 중' }: { children: ReactNode; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="motion-safe:animate-pulse">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}
