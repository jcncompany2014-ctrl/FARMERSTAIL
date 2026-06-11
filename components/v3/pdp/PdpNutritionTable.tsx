/**
 * PdpNutritionTable — 38 영양소 table + 권장치 대비 bar.
 *
 * 핸드오프 패턴 (item 63):
 *   - heading "영양소 구성" + Mono mute kicker "PER 100G"
 *   - 각 row: name + value + 권장 대비 percentage bar.
 *   - bar tone:
 *       sage   — 권장 80–120% 이내 (안정)
 *       yellow — 권장 60–80% 또는 120–140% (경계)
 *       accent — 권장 외 (과부족)
 *   - paperHi card + 1px rule + radius 4.
 *
 * 데이터: NutrientRow[] — name + value + percent vs RDA.
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface NutrientRow {
  /** 영양소 이름 — 단백질 / 지방 / 칼슘 / 인 등. */
  name: string
  /** value text — "28%" / "1.2g" / "320mg". */
  value: string
  /** 권장 대비 % (100 = 권장 충족). 0~200+ 범위. */
  percentVsRda: number
  /** 노트 (옵션) — 권장 구간 표시 등. */
  note?: string
}

interface PdpNutritionTableProps {
  /** Section heading. 기본 "영양소 구성". */
  heading?: string
  /** Kicker — 기본 "PER 100G". */
  kicker?: string
  rows: NutrientRow[]
  /** 더 보기 링크 — "전체 38 영양소 보기 →". */
  viewAllHref?: string
}

function classifyPercent(p: number): 'sage' | 'yellow' | 'accent' {
  if (p >= 80 && p <= 120) return 'sage'
  if ((p >= 60 && p < 80) || (p > 120 && p <= 140)) return 'yellow'
  return 'accent'
}

const TONE_BAR: Record<'sage' | 'yellow' | 'accent', string> = {
  sage: V3.sage,
  yellow: V3.yellow,
  accent: V3.accent,
}

export default function PdpNutritionTable({
  heading = '영양소 구성',
  kicker = 'PER 100G',
  rows,
  viewAllHref,
}: PdpNutritionTableProps) {
  if (rows.length === 0) return null

  return (
    <section style={{ padding: '0 20px 28px' }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 14 }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: V3.ink,
            letterSpacing: '-0.025em',
            wordBreak: 'keep-all',
          }}
        >
          {heading}
        </h2>
        <Mono color="inkMute" size="xs" weight={500}>
          {kicker}
        </Mono>
      </div>

      <div className="ft-card-v3" style={{ padding: '4px 16px' }}>
        {rows.map((row, i) => {
          const tone = classifyPercent(row.percentVsRda)
          const pct = Math.min(140, Math.max(0, row.percentVsRda)) // visual cap 140%
          return (
            <div
              key={row.name}
              style={{
                padding: '12px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
              }}
            >
              <div className="flex justify-between items-baseline">
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    color: V3.ink,
                    fontWeight: V3FontWeight.bold,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {row.name}
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    color: V3.ink,
                    fontWeight: V3FontWeight.semibold,
                  }}
                >
                  {row.value}
                </span>
              </div>
              <div
                className="relative"
                style={{
                  marginTop: 6,
                  height: 4,
                  borderRadius: 2,
                  background: V3.ruleSoft,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct / 1.4}%`, // 100% 가 권장 = bar 71% (max 100% bar = 140% RDA)
                    height: '100%',
                    background: TONE_BAR[tone],
                    transition: 'width 200ms',
                  }}
                />
              </div>
              {row.note && (
                <Mono
                  color="inkMute"
                  size="xxs"
                  weight={500}
                  upper={false}
                  letterSpacing="0"
                  style={{ display: 'block', marginTop: 4 }}
                >
                  {row.note}
                </Mono>
              )}
            </div>
          )
        })}
      </div>

      {viewAllHref && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <a
            href={viewAllHref}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: V3.ink,
              fontWeight: 600,
            }}
          >
            전체 영양소 보기 →
          </a>
        </div>
      )}
    </section>
  )
}
