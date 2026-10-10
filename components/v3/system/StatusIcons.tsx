import type { ReactNode } from 'react'
import { V3 } from '@/lib/design/tokens'

/**
 * 상태 화면 그림 3종 — 시안 B03(화면 오류)·B04(앱 전체 오류)·B05(없는 주소) 의 선 그림 그대로
 * (2026-10-09 'A 포스터').
 *
 * 먹선 그림에 한 군데만 빨강(오류색 V3.sale) — 느낌표·X·물음표. 아이콘 꾸러미(lucide)는 한 그림에
 * 한 색이라 시안의 '먹 + 빨강 한 점'이 안 나와서 시안의 선을 그대로 옮겼다(24 격자, 선 굵기 2).
 * 전부 장식이다(aria-hidden) — 뜻은 바로 아래 제목이 말한다.
 */

interface IconProps {
  /** 한 변(px). 72 네모 칸 안에서 40 이 시안 값. */
  size?: number
}

function Frame({ size = 40, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={V3.ink}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** 화면 오류(B03) — 동그라미 안 느낌표. */
export function AlertMarkIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" stroke={V3.sale} strokeWidth={2.4} />
      <circle cx="12" cy="16.6" r="1.25" fill={V3.sale} stroke="none" />
    </Frame>
  )
}

/** 앱 전체 오류(B04) — 휴대폰 화면 위 X. */
export function AppCrashIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M10 8.5l4 4M14 8.5l-4 4" stroke={V3.sale} strokeWidth={2.4} />
      <path d="M10.5 18.5h3" />
    </Frame>
  )
}

/** 없는 주소(B05) — 돋보기 안 물음표. */
export function NotFoundIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="10.5" cy="10.5" r="6.8" />
      <path d="M15.6 15.6L21 21" />
      <path d="M8.7 9a1.9 1.9 0 1 1 2.8 1.7c-.6.3-1 .8-1 1.4v.2" stroke={V3.sale} strokeWidth={2.2} />
      <circle cx="10.5" cy="14.4" r="1.05" fill={V3.sale} stroke="none" />
    </Frame>
  )
}
