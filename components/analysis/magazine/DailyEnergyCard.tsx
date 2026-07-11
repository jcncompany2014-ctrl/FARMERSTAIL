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
  /**
   * 칼로리 v2 6단계 — 계수 사다리 (analyses.factor_breakdown).
   * [0] = 기본값(또는 성장기·감량 등 단일 요약), 이후 = 부호 있는 가산/감산.
   * 과거 분석(v2 이전)은 없음 → 사다리 생략, ±30% 문구만.
   */
  breakdown?: { label: string; delta: number }[] | null
}

/** 0.15 → "0.15", 1.40 → "1.4" — 사다리 숫자 표기. */
function fmtDelta(n: number): string {
  return (Math.round(Math.abs(n) * 100) / 100).toString()
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

        {/* 계수 사다리 — 스펙 v2 §5 "계수 근거 노출 = 투명성이 곧 마케팅 자산".
            감산(−)=올리브(비만 예방 방향), 가산(+)=브랜드, 시작값=잉크. */}
        {data.breakdown && data.breakdown.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: '12px 14px',
              background: p.cardSoft,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: p.muted,
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              계수 {data.factor.toFixed(2)}는 이렇게 나왔어요
            </div>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {data.breakdown.map((line, i) => (
                <div
                  key={`${line.label}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ color: p.ink2, lineHeight: 1.45 }}>
                    {line.label}
                  </span>
                  <span
                    style={{
                      color:
                        i === 0
                          ? p.ink
                          : line.delta < 0
                            ? p.accentOlive
                            : p.brand,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {i === 0
                      ? fmtDelta(line.delta)
                      : `${line.delta < 0 ? '−' : '+'}${fmtDelta(line.delta)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 개체차 안내 — 스펙 v2 §7: 시작 추정치임을 수치 옆에서 정직하게. */}
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            lineHeight: 1.55,
            color: p.muted,
          }}
        >
          같은 조건이라도 아이마다 필요 열량은 ±30%까지 달라요. 이 수치는
          시작 추정치예요 — 2~4주 체중 변화를 보고 조금씩 맞춰가요.
        </p>
      </ReportCard>
    </Reveal>
  )
}
