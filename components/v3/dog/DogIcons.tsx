/**
 * DogIcons — 우리 아이·기록·등록·건강 관리 화면(시안 T07·T08·AppDog·D01~D21)의 선 그림.
 *
 * 2026-10-09 앱 새 디자인('A 포스터'): 시안 원본 HTML 의 SVG 선(24 격자)을 그대로 옮겼다.
 * lucide 아이콘은 모양·굵기가 시안과 조금씩 달라 나란히 비교하면 티가 난다 — 그래서 이 화면 묶음은
 * 여기 그림만 쓴다. 전부 장식(aria-hidden) — 뜻은 옆 글자나 버튼의 aria-label 이 말한다.
 * 훅이 없어 서버·클라이언트 어디서든 그려진다.
 */

import type { CSSProperties, ReactNode } from 'react'

export interface DogIconProps {
  size?: number
  /** 선 색 — 기본 currentColor(부모 글자색). */
  color?: string
  /** 선 굵기 — 시안마다 2~3. */
  strokeWidth?: number
  style?: CSSProperties
}

function Line({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  children,
}: DogIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {children}
    </svg>
  )
}

export function PlusIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.6} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  )
}

export function TrashIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7l1 13h9l1-13" />
    </Line>
  )
}

export function CheckIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.6} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Line>
  )
}

export function XIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.6} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Line>
  )
}

export function ChevronDownIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.4} {...p}>
      <path d="M6 9l6 6 6-6" />
    </Line>
  )
}

export function ChevronUpIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.4} {...p}>
      <path d="M6 15l6-6 6 6" />
    </Line>
  )
}

export function ChevronRightIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.2} {...p}>
      <path d="M9 6l6 6-6 6" />
    </Line>
  )
}

export function ArrowRightIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.6} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Line>
  )
}

export function CameraIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M3.5 8h4l2-3h5l2 3h4v11.5h-17z" />
      <circle cx="12" cy="13" r="3.5" />
    </Line>
  )
}

/** 건강일지 — 하트 + 맥박 선. */
export function HeartPulseIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M6 12h3.5l1.5-2.5 2 4.5 1.5-2h3.5" />
    </Line>
  )
}

export function CalendarIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Line>
  )
}

export function ClockIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Line>
  )
}

export function SearchIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.2} {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Line>
  )
}

export function PillIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7z" />
      <path d="M8.5 8.5l7 7" />
    </Line>
  )
}

export function SyringeIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M18 2l4 4M17 7l3-3M19 9l-8.7 8.7-4-4L15 5zM9 11l4 4M5 19l-3 3M14 4l6 6" />
    </Line>
  )
}

export function ScissorsIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" />
    </Line>
  )
}

export function StethoscopeIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M10 13v2a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="11" r="2" />
    </Line>
  )
}

export function BellIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 21h4" />
    </Line>
  )
}

export function PencilIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </Line>
  )
}

/** 삼각형 경고 — 강아지 삭제 확인(D21). */
export function WarningIcon(p: DogIconProps) {
  return (
    <Line {...p}>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </Line>
  )
}

/** 설문(클립보드) — 등록 환영 창 버튼(D12). */
export function ClipboardIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.2} {...p}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3h6v1" />
      <path d="M9 10h6M9 14h6" />
    </Line>
  )
}

/** 체중계 — 새 체중 기록(D20). */
export function ScaleIcon(p: DogIconProps) {
  return (
    <Line strokeWidth={2.2} {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 9a5.5 5.5 0 0 1 8 0l-2 2.5h-4z" />
    </Line>
  )
}

/** 다시 시작(채운 세모) — 리마인더 일시중지 해제. */
export function PlayIcon({ size = 14, color = 'currentColor', style }: DogIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={{ flexShrink: 0, display: 'block', ...style }}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  )
}

/** 채운 하트 — '보호자님께'·탭바와 같은 하트. */
export function HeartFillIcon({ size = 16, color = 'currentColor', style }: DogIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={{ flexShrink: 0, display: 'block', ...style }}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

/** 채운 발바닥 — 사진 없는 아이 자리(T07·T08·D11). 아래 탭 가운데 버튼과 같은 그림. */
export function PawFillIcon({ size = 26, color = 'currentColor', style }: DogIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={{ flexShrink: 0, display: 'block', ...style }}>
      <ellipse cx="6.2" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="9.8" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="14.2" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="17.8" cy="10" rx="1.9" ry="2.4" />
      <path d="M12 11.2c-2.6 0-5 2.8-5 5.2 0 1.7 1.3 2.6 2.7 2.6 1 0 1.6-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.9 2.7-2.6 0-2.4-2.4-5.2-5-5.2z" />
    </svg>
  )
}

/**
 * 기분 얼굴 5단계(일기 — 시안 D01·D02). 1 = 많이 안 좋아요 … 5 = 아주 좋아요.
 * 예전 lucide Frown/Annoyed/Meh/Smile/Laugh 자리.
 */
export function MoodFaceIcon({ score, ...p }: DogIconProps & { score: number }) {
  const eyesDot = <path d="M9 9h.01M15 9h.01" />
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="10" />
      {score <= 1 && (
        <>
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          {eyesDot}
        </>
      )}
      {score === 2 && (
        <>
          <path d="M8 15h8" />
          <path d="M8 9h2M14 9h2" />
        </>
      )}
      {score === 3 && (
        <>
          <path d="M8 15h8" />
          {eyesDot}
        </>
      )}
      {score === 4 && (
        <>
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          {eyesDot}
        </>
      )}
      {score >= 5 && (
        <>
          <path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12z" />
          {eyesDot}
        </>
      )}
    </Line>
  )
}
