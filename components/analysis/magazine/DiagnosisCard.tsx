'use client'

/**
 * Magazine DiagnosisCard — 칩 row + 진단 문장 (브랜드 컬러 + 형광펜 하이라이트) +
 * AAFCO 풋터. -14px margin 으로 hero 위에 올라타듯.
 */

import { ShieldCheck } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface DiagnosisChip {
  label: string
  variant: 'primary' | 'soft'
}

interface DiagnosisCardProps {
  p: MagazinePalette
  dogName: string
  chips: DiagnosisChip[]
  /** 진단 문장. 2-3줄 권장. */
  headline: {
    /** ex: '단백질은' */
    intro: string
    /** ex: '넉넉히' — brand color */
    accentBrand: string
    /** ex: ', 지방은' */
    middle: string
    /** ex: '살짝 더' — ochre color */
    accentOchre: string
    /** ex: '. {dogName}이의 마른 체형에' */
    body: string
    /** ex: '활력을 채워줄게요.' — 형광펜 highlight */
    highlight: string
  }
  /** 가이드라인 버전 라벨. ex: 'AAFCO 2024' */
  guidelineLabel?: string
  /** 분석 버전 + 일자. ex: '분석 v2.4 · 2026.05.19' */
  versionLabel?: string
}

export function DiagnosisCard({
  p,
  chips,
  headline,
  guidelineLabel = 'AAFCO 2024 영양 기준 충족',
  versionLabel,
}: DiagnosisCardProps) {
  return (
    <Reveal delay={380}>
      <div
        style={{
          margin: '-14px 18px 0',
          position: 'relative',
          zIndex: 2,
          padding: '20px 22px 18px',
          background: p.card,
          borderRadius: 12,
          boxShadow: `0 18px 40px ${p.ink}1c, 0 1px 0 ${p.line}55`,
        }}
      >
        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c, i) => (
            <DiagChip
              key={i}
              p={p}
              bg={c.variant === 'primary' ? p.brand : p.cardSoft}
              fg={c.variant === 'primary' ? '#fff' : p.ink2}
            >
              {c.label}
            </DiagChip>
          ))}
        </div>

        {/* Diagnosis sentence */}
        <div
          style={{
            marginTop: 16,
            fontSize: 17,
            fontWeight: 700,
            color: p.ink,
            lineHeight: 1.55,
            letterSpacing: '-0.015em',
          }}
        >
          {headline.intro} <span style={{ color: p.brand }}>{headline.accentBrand}</span>
          {headline.middle} <span style={{ color: p.accentOchre }}>{headline.accentOchre}</span>
          <br />
          {headline.body}
          <br />
          <span
            style={{
              background: `linear-gradient(180deg, transparent 62%, ${p.accentOchre}55 62%, ${p.accentOchre}55 92%, transparent 92%)`,
              padding: '0 2px',
            }}
          >
            {headline.highlight}
          </span>
        </div>

        {/* Compliance footer */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px dashed ${p.line}aa`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldCheck size={14} color={p.accentOlive} strokeWidth={2.2} />
          <div style={{ fontSize: 11.5, fontWeight: 700, color: p.accentOlive }}>
            {guidelineLabel}
          </div>
          <div style={{ flex: 1 }} />
          {versionLabel && (
            <div style={{ fontSize: 10.5, color: p.muted, fontWeight: 600 }}>
              {versionLabel}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  )
}

function DiagChip({
  children,
  bg,
  fg,
}: {
  children: React.ReactNode
  p: MagazinePalette
  bg: string
  fg: string
}) {
  return (
    <div
      style={{
        padding: '6px 11px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.01em',
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
