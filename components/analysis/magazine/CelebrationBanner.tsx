'use client'

/**
 * Magazine CelebrationBanner — 적색 도장 + "맞춤 처방이 준비됐어요" + 스파클.
 * "잉크 도장이 찍힌 종이" 분위기.
 */

import { Check, Sparkles } from 'lucide-react'
import { petName } from '@/lib/korean'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface CelebrationBannerProps {
  p: MagazinePalette
  dogName: string
  /** 스탬프 일자 — 'MM.DD' */
  dateLabel: string
}

export function CelebrationBanner({ p, dogName, dateLabel }: CelebrationBannerProps) {
  return (
    <Reveal delay={420}>
      <div
        style={{
          margin: '14px 18px 0',
          padding: '14px 16px',
          background: `${p.brand}12`,
          color: p.ink,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `inset 0 0 0 1px ${p.brand}33`,
        }}
      >
        {/* Soft radial wash */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(circle at 0% 50%, ${p.brand}1a 0%, transparent 50%)`,
          }}
        />
        {/* Sparkles */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 60,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        >
          <Sparkles size={10} color={p.brand} strokeWidth={2} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 100,
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        >
          <Sparkles size={8} color={p.accentOchre} strokeWidth={2} />
        </div>

        {/* Red stamp seal */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: p.brand,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
            boxShadow: `0 4px 10px ${p.brand}55`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 3,
              borderRadius: 999,
              border: `1px solid rgba(255,255,255,0.4)`,
            }}
          />
          <Check size={22} color="#fff" strokeWidth={3} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div
            style={{
              fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
              fontSize: 9.5,
              letterSpacing: '0.3em',
              color: p.brand,
              fontWeight: 700,
            }}
          >
            SURVEY · COMPLETE
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginTop: 2,
              color: p.ink,
              letterSpacing: '-0.005em',
            }}
          >
            {petName(dogName)} 맞춤 처방이 준비됐어요
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
            fontSize: 9.5,
            letterSpacing: '0.18em',
            color: p.muted,
            fontWeight: 700,
            position: 'relative',
          }}
        >
          {dateLabel}
        </div>
      </div>
    </Reveal>
  )
}
