'use client'

/**
 * Magazine NutrientsCard — 4 영양소 row (단백·지방·탄수·식이섬유).
 * 막대 = 회색 트랙 + 권장 범위 음영 + 솔리드 fill (0% → value, 1100ms ease-out).
 */

import { Check } from 'lucide-react'
import type { MagazinePalette } from './palette'
import { Reveal, CountUp, useReveal } from './primitives'
import { ReportCard, SectionHeader } from './ReportCard'

export interface NutrientRow {
  key: 'protein' | 'fat' | 'carb' | 'fiber'
  name: string
  emoji: string
  /** 실측값 % */
  value: number
  /** 일 g */
  gpd: number
  /** 권장 하한 % */
  min: number
  /** 권장 상한 % */
  max: number
}

export function NutrientsCard({
  p,
  rows,
}: {
  p: MagazinePalette
  rows: NutrientRow[]
}) {
  const colorOf = (key: NutrientRow['key']): string => {
    switch (key) {
      case 'protein':
        return p.brand
      case 'fat':
        return p.accentOchre
      case 'carb':
        return p.accentOlive
      case 'fiber':
        return p.accentBlush
    }
  }
  const allInRange = rows.every((r) => r.value >= r.min && r.value <= r.max)

  return (
    <Reveal delay={80}>
      <ReportCard p={p}>
        <SectionHeader
          p={p}
          eyebrow="NUTRIENT PROFILE"
          title="영양 균형"
          tail="AAFCO 2024 권장 범위 대비"
        />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rows.map((n) => (
            <NutrientRowView key={n.key} p={p} n={n} color={colorOf(n.key)} />
          ))}
        </div>

        {/* All in range pill */}
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            background: allInRange ? `${p.accentOlive}14` : `${p.brand}14`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: allInRange ? p.accentOlive : p.brand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Check size={14} color="#fff" strokeWidth={3} />
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: allInRange ? p.accentOlive : p.brand,
              letterSpacing: '-0.01em',
            }}
          >
            {allInRange
              ? `${rows.length}가지 영양소 모두 권장 범위 안이에요`
              : `일부 영양소가 권장 범위 밖이에요`}
          </div>
        </div>
      </ReportCard>
    </Reveal>
  )
}

function NutrientRowView({
  p,
  n,
  color,
}: {
  p: MagazinePalette
  n: NutrientRow
  color: string
}) {
  const inRange = n.value >= n.min && n.value <= n.max
  const [ref, shown] = useReveal({ threshold: 0.3 })
  return (
    <div ref={ref}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{n.emoji}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: p.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {n.name}
        </span>
        <span style={{ fontSize: 11, color: p.muted, fontWeight: 600 }}>
          {n.gpd}g/일
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 22,
            fontWeight: 900,
            color,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          <CountUp to={n.value} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: p.muted,
              marginLeft: 1,
            }}
          >
            %
          </span>
        </span>
      </div>

      {/* Bar with embedded range zone */}
      <div style={{ position: 'relative', height: 12 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `${p.line}aa`,
            borderRadius: 6,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${n.min}%`,
            width: `${n.max - n.min}%`,
            background: `${color}33`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: shown ? `${n.value}%` : '0%',
            background: color,
            borderRadius: 6,
            transition: 'width 1100ms cubic-bezier(.2,.7,.2,1) 100ms',
          }}
        />
      </div>

      <div style={{ position: 'relative', height: 14, marginTop: 4 }}>
        <span
          style={{
            position: 'absolute',
            left: `${n.min}%`,
            transform: 'translateX(-50%)',
            fontSize: 9.5,
            color: p.muted,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {n.min}%
        </span>
        <span
          style={{
            position: 'absolute',
            left: `${n.max}%`,
            transform: 'translateX(-50%)',
            fontSize: 9.5,
            color: p.muted,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {n.max}%
        </span>
        <span
          style={{
            position: 'absolute',
            right: 0,
            fontSize: 10.5,
            fontWeight: 700,
            color: inRange ? p.accentOlive : p.brand,
          }}
        >
          {inRange ? '권장 범위 안' : '확인 필요'}
        </span>
      </div>
    </div>
  )
}
