'use client'

/**
 * Magazine ReportCard — 4 코너 톤보 (registration mark) + 부드러운 그림자.
 * Claude Design 'SURVEY TIME' handoff 의 ReportCard / CornerMark / SectionHeader 포팅.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { MagazinePalette } from './palette'

interface ReportCardProps {
  p: MagazinePalette
  children: ReactNode
  tint?: string
  style?: CSSProperties
}

export function ReportCard({ p, children, tint, style }: ReportCardProps) {
  return (
    <div
      style={{
        margin: '14px 18px 0',
        position: 'relative',
        background: tint || p.card,
        borderRadius: 22,
        padding: '22px 22px 22px',
        boxShadow: `0 1px 0 ${p.line}55, 0 12px 28px ${p.ink}10`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <CornerMark p={p} corner="tl" />
      <CornerMark p={p} corner="bl" />
      <CornerMark p={p} corner="br" />
      {children}
    </div>
  )
}

function CornerMark({
  p,
  corner,
}: {
  p: MagazinePalette
  corner: 'tl' | 'tr' | 'bl' | 'br'
}) {
  const pos = {
    tl: { top: 8, left: 8 },
    tr: { top: 8, right: 8 },
    bl: { bottom: 8, left: 8 },
    br: { bottom: 8, right: 8 },
  }[corner]
  const flipX = corner.includes('r')
  const flipY = corner.includes('b')
  return (
    <div
      style={{
        position: 'absolute',
        ...pos,
        width: 10,
        height: 10,
        opacity: 0.32,
        pointerEvents: 'none',
        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M0.5 4 L0.5 0.5 L4 0.5" stroke={p.muted} strokeWidth="1" fill="none" />
      </svg>
    </div>
  )
}

interface SectionHeaderProps {
  p: MagazinePalette
  eyebrow: string
  title: string
  tail?: string
}

export function SectionHeader({ p, eyebrow, title, tail }: SectionHeaderProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
          fontSize: 9.5,
          letterSpacing: '0.3em',
          color: p.muted,
          fontWeight: 700,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: p.ink,
          marginTop: 2,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      {tail && (
        <div style={{ fontSize: 11, color: p.muted, marginTop: 2 }}>{tail}</div>
      )}
    </div>
  )
}
