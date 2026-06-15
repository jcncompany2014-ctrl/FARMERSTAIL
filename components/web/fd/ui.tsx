/**
 * FD 클론 공용 프리미티브 (farm v6, 2026-06-13).
 *
 * The Farmer's Dog 디자인 시스템을 우리 토큰으로:
 *   - 색: --fd-pine / --fd-green / --fd-cream / --fd-offwhite / --fd-coral
 *   - 버튼: pill (rounded-full), 카드: 거의 각짐(rounded 4), 헤드라인: Pretendard 900 타이트
 *   - 영어는 Eyebrow/Hand 악센트로만, 본문은 한글.
 *
 * 전부 서버 컴포넌트(필요 시 'use client' 분리). 사진은 PhotoSlot placeholder.
 */
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Container — 최대폭 + 좌우 패딩
// ---------------------------------------------------------------------------
export function Container({
  children,
  size = 'lg',
  className,
}: {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const max = size === 'sm' ? 720 : size === 'md' ? 960 : size === 'xl' ? 1280 : 1140
  return (
    <div className={`mx-auto px-5 md:px-8 ${className ?? ''}`} style={{ maxWidth: max }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section — bg 변형 + 수직 패딩 (색 블로킹)
// ---------------------------------------------------------------------------
type SectionBg = 'offwhite' | 'cream' | 'white' | 'pine' | 'green' | 'coral'

const SECTION_BG: Record<SectionBg, CSSProperties> = {
  offwhite: { background: 'var(--fd-offwhite)', color: 'var(--fd-pine)' },
  cream: { background: 'var(--fd-cream)', color: 'var(--fd-pine)' },
  white: { background: '#FFFFFF', color: 'var(--fd-pine)' },
  pine: { background: 'var(--fd-pine)', color: '#FFFFFF' },
  green: { background: 'var(--fd-green)', color: '#FFFFFF' },
  coral: { background: 'var(--fd-coral)', color: '#FFFFFF' },
}

export function Section({
  children,
  bg = 'offwhite',
  pad = 'lg',
  className,
  id,
}: {
  children: ReactNode
  bg?: SectionBg
  pad?: 'sm' | 'md' | 'lg'
  className?: string
  id?: string
}) {
  const padCls =
    pad === 'sm' ? 'py-10 md:py-14' : pad === 'md' ? 'py-12 md:py-20' : 'py-16 md:py-28'
  return (
    <section id={id} className={`${padCls} ${className ?? ''}`} style={SECTION_BG[bg]}>
      {children}
    </section>
  )
}

/** 섹션 bg 가 다크(pine/green/coral)인지 — 텍스트 대비 분기용. */
export function isDarkBg(bg: SectionBg): boolean {
  return bg === 'pine' || bg === 'green' || bg === 'coral'
}

// ---------------------------------------------------------------------------
// Button — pill. tone/size 변형. href 있으면 Link, 없으면 button.
// ---------------------------------------------------------------------------
type BtnTone = 'coral' | 'pine' | 'green' | 'cream' | 'outline' | 'outlineLight'

const BTN_TONE: Record<BtnTone, CSSProperties> = {
  coral: { background: 'var(--fd-coral)', color: '#FFFFFF' },
  pine: { background: 'var(--fd-pine)', color: '#FFFFFF' },
  green: { background: 'var(--fd-green)', color: '#FFFFFF' },
  cream: { background: 'var(--fd-cream)', color: 'var(--fd-pine)' },
  outline: { background: 'transparent', color: 'var(--fd-pine)', border: '2px solid var(--fd-pine)' },
  outlineLight: { background: 'transparent', color: '#FFFFFF', border: '2px solid rgba(255,255,255,0.65)' },
}

export function Button({
  href,
  children,
  tone = 'coral',
  size = 'md',
  full = false,
  className,
}: {
  href?: string
  children: ReactNode
  tone?: BtnTone
  size?: 'sm' | 'md' | 'lg'
  full?: boolean
  className?: string
}) {
  const sizeCls =
    size === 'sm'
      ? 'h-11 px-5 text-[14px]'
      : size === 'lg'
        ? 'h-[58px] px-9 text-[16px] md:text-[17px]'
        : 'h-[52px] px-7 text-[15px] md:text-[16px]'
  // hover: 톤 무관 피드백 — 인라인 배경색을 못 덮으므로 filter(brightness)+lift 사용
  // (FdSlider 화살표 회차91 과 같은 인라인-style 한계 회피). transition 이 transform·
  // filter 까지 전이하므로 부드럽게. active 는 눌림(아래로) 유지.
  const cls = `inline-flex items-center justify-center gap-2 rounded-full no-underline transition hover:brightness-[0.94] hover:-translate-y-[1px] active:translate-y-[1px] ${sizeCls} ${full ? 'w-full' : ''} ${className ?? ''}`
  const style: CSSProperties = {
    fontWeight: 800,
    letterSpacing: '-0.01em',
    ...BTN_TONE[tone],
  }
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} style={style}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Eyebrow — 영문 소형 대문자 라벨 (섹션 머리 악센트)
// ---------------------------------------------------------------------------
export function Eyebrow({
  children,
  color = 'var(--fd-green)',
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hand — 손글씨 악센트 (절제 사용, 한두 단어)
// ---------------------------------------------------------------------------
export function Hand({
  children,
  color = 'var(--fd-coral)',
  className,
  style,
}: {
  children: ReactNode
  color?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'var(--font-hand), cursive', color, lineHeight: 1, ...style }}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Display — 헤드라인 (Pretendard 900 타이트). as 로 태그 선택.
// ---------------------------------------------------------------------------
export function Display({
  children,
  as = 'h2',
  size = 'lg',
  className,
  style,
}: {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  size?: 'xl' | 'lg' | 'md' | 'sm'
  className?: string
  style?: CSSProperties
}) {
  const fs =
    size === 'xl'
      ? 'clamp(38px, 9.5vw, 68px)'
      : size === 'lg'
        ? 'clamp(30px, 6.8vw, 50px)'
        : size === 'md'
          ? 'clamp(25px, 5.2vw, 38px)'
          : 'clamp(21px, 4vw, 28px)'
  const Tag = as
  return (
    <Tag
      className={className}
      style={{
        fontSize: fs,
        fontWeight: 900,
        letterSpacing: '-0.035em',
        lineHeight: 1.04,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ---------------------------------------------------------------------------
// Stat — 큰 숫자 통계 (label 보조)
// ---------------------------------------------------------------------------
export function Stat({
  value,
  label,
  className,
}: {
  value: ReactNode
  label: ReactNode
  className?: string
}) {
  return (
    <div className={`text-center ${className ?? ''}`}>
      <div style={{ fontSize: 'clamp(36px, 8vw, 64px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, opacity: 0.82 }}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PhotoSlot — 사진 자리 (솔리드 색면 + 라벨 칩). 점선 와이어프레임 X.
//   사장님이 실제 이미지로 교체하면 끝나게. tone 으로 섹션 배경과 어울리게.
// ---------------------------------------------------------------------------
type SlotTone = 'cream' | 'green' | 'pine' | 'coral' | 'offwhite'

const SLOT_TONE: Record<SlotTone, { bg: string; ink: string; chip: string }> = {
  cream: { bg: 'var(--fd-cream)', ink: 'var(--fd-pine)', chip: 'rgba(255,255,255,0.7)' },
  offwhite: { bg: '#ECE7DA', ink: 'var(--fd-pine)', chip: 'rgba(255,255,255,0.75)' },
  green: { bg: 'var(--fd-green)', ink: '#FFFFFF', chip: 'rgba(255,255,255,0.18)' },
  pine: { bg: 'var(--fd-pine)', ink: '#FFFFFF', chip: 'rgba(255,255,255,0.16)' },
  coral: { bg: 'var(--fd-coral)', ink: '#FFFFFF', chip: 'rgba(255,255,255,0.2)' },
}

export function PhotoSlot({
  label,
  sub,
  ratio = '4 / 3',
  tone = 'cream',
  rounded = 6,
  className,
  src,
  alt,
}: {
  label: string
  sub?: string
  ratio?: string
  tone?: SlotTone
  rounded?: number
  className?: string
  /** 실제 이미지 URL. 주어지면 placeholder 대신 사진을 채운다(임시 사진 주입용). */
  src?: string
  alt?: string
}) {
  const t = SLOT_TONE[tone]
  if (src) {
    return (
      <div
        className={`relative ${className ?? ''}`}
        style={{ aspectRatio: ratio, borderRadius: rounded, overflow: 'hidden', background: t.bg }}
      >
        <img src={src} alt={alt ?? label} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ''}`}
      style={{ aspectRatio: ratio, borderRadius: rounded, background: t.bg, overflow: 'hidden' }}
    >
      <span
        className="inline-flex items-center gap-2 rounded-full"
        style={{ padding: '8px 14px', background: t.chip, color: t.ink }}
      >
        {/* 카메라 아이콘 (인라인 svg — lucide 의존 줄임) */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{label}</span>
      </span>
      {sub && (
        <span
          className="absolute text-center"
          style={{ bottom: 12, left: 12, right: 12, fontSize: 11, fontWeight: 600, color: t.ink, opacity: 0.72 }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}
