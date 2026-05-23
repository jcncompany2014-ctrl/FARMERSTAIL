'use client'

/**
 * Magazine AtAGlance — KPI 4 strip (KCAL / 급여량 / 끼니당 / 체형).
 */

import { Flame, Scale, Bone, Sparkles } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal, CountUp } from './primitives'

export interface AtAGlanceData {
  kcalPerDay: number
  feedGramPerDay: number
  kcalPerMeal: number
  bcsLabel: string
}

export function AtAGlance({ p, data }: { p: MagazinePalette; data: AtAGlanceData }) {
  const items: Array<{
    label: string
    value: number | string
    suffix?: string
    accent: string
    icon: React.ReactNode
    text?: boolean
  }> = [
    {
      label: 'KCAL / 일',
      value: data.kcalPerDay,
      suffix: '',
      accent: p.brand,
      icon: <Flame size={16} color={p.brand} strokeWidth={1.8} />,
    },
    {
      label: '급여량 / 일',
      value: data.feedGramPerDay,
      suffix: 'g',
      accent: p.accentOlive,
      icon: <Scale size={16} color={p.accentOlive} strokeWidth={1.8} />,
    },
    {
      label: '끼니당',
      value: data.kcalPerMeal,
      suffix: ' kcal',
      accent: p.accentOchre,
      icon: <Bone size={16} color={p.accentOchre} strokeWidth={1.8} />,
    },
    {
      label: '체형',
      value: data.bcsLabel,
      accent: p.accentWine,
      icon: <Sparkles size={16} color={p.accentWine} strokeWidth={1.8} />,
      text: true,
    },
  ]

  return (
    <Reveal delay={50}>
      <div
        style={{
          margin: '14px 18px 0',
          padding: '14px 6px',
          background: p.card,
          borderRadius: 12,
          display: 'flex',
          boxShadow: `0 1px 0 ${p.line}66, 0 8px 22px ${p.ink}08`,
        }}
      >
        {items.map((it, i) => (
          <span key={it.label} style={{ display: 'contents' }}>
            <div style={{ flex: 1, padding: '4px 8px', textAlign: 'center' }}>
              {it.icon}
              <div
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  color: p.muted,
                  letterSpacing: '0.16em',
                }}
              >
                {it.label}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: it.text ? 13 : 20,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: '-0.01em',
                }}
              >
                {it.text ? (
                  (it.value as string)
                ) : (
                  <>
                    <CountUp to={it.value as number} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: p.muted,
                        marginLeft: 1,
                      }}
                    >
                      {it.suffix}
                    </span>
                  </>
                )}
              </div>
            </div>
            {i < items.length - 1 && (
              <div
                style={{
                  width: 1,
                  background: p.line,
                  opacity: 0.6,
                  margin: '4px 0',
                }}
              />
            )}
          </span>
        ))}
      </div>
    </Reveal>
  )
}
