'use client'

/**
 * Magazine DailyEnergyCard — 88px 거대한 MER 카운트업 + range bar + 계산식.
 */

import { petName } from '@/lib/korean'
import type { MagazinePalette } from './palette'
import { Reveal, CountUp, BarFill } from './primitives'
import { ReportCard } from './ReportCard'

export interface DailyEnergyData {
  /** MER kcal/일 */
  mer: number
  /** RER kcal/일 */
  rer: number
  /** 활동·중성화 등 합산 factor */
  factor: number
  /** 신뢰구간 하한 kcal */
  merMin: number
  /** 신뢰구간 상한 kcal */
  merMax: number
  /** 가이드라인 라벨. ex: 'NRC 2006' */
  guideline: string
}

export function DailyEnergyCard({
  p,
  data,
  dogName,
}: {
  p: MagazinePalette
  data: DailyEnergyData
  dogName: string
}) {
  const range = Math.max(1, data.merMax - data.merMin)
  const pct = Math.max(0, Math.min(100, ((data.mer - data.merMin) / range) * 100))

  return (
    <Reveal delay={80}>
      <ReportCard p={p}>
        <div
          style={{
            fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
            fontSize: 10,
            letterSpacing: '0.3em',
            color: p.muted,
            fontWeight: 700,
          }}
        >
          DAILY ENERGY · MER
        </div>
        <div style={{ fontSize: 12.5, color: p.muted, marginTop: 2 }}>
          {petName(dogName)}가 하루 체중 유지에 필요한 에너지
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: p.brand,
              lineHeight: 0.9,
              letterSpacing: '-0.04em',
            }}
          >
            <CountUp to={data.mer} />
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: p.ink2 }}>kcal</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <BarFill pct={pct} color={p.brand} bg={`${p.brand}22`} height={6} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
              color: p.muted,
              fontWeight: 600,
            }}
          >
            <span>최소 {data.merMin}</span>
            <span style={{ color: p.ink2 }}>현재 {data.mer} kcal</span>
            <span>최대 {data.merMax}</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            background: p.cardSoft,
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: p.muted,
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              계산식
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: p.ink,
                marginTop: 2,
              }}
            >
              RER {Math.round(data.rer)}{' '}
              <span style={{ color: p.muted, fontWeight: 500 }}>×</span>{' '}
              {data.factor.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              padding: '4px 10px',
              background: `${p.accentOlive}1f`,
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 700,
              color: p.accentOlive,
              letterSpacing: '0.08em',
            }}
          >
            {data.guideline}
          </div>
        </div>
      </ReportCard>
    </Reveal>
  )
}
