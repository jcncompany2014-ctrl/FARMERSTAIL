/**
 * DogStatsGrid — 4-tile core stats (item 48).
 *
 * 핸드오프 패턴:
 *   - 2×2 grid + 각 tile: Mono kicker + 30px sans 800 value + Mono sub
 *   - 하단 1px rule + Mono trend label (완료 / 예정 / 최고기록 등)
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface DogStat {
  /** 라벨 — Mono kicker. */
  key: string
  /** 큰 값. */
  value: string
  /** 보조 단위 — Mono. */
  sub: string
  /** 트렌드/상태 라벨 — 하단 mono mute. */
  trend?: string
  /** 색 tone. */
  tone?: 'ink' | 'sage' | 'accent' | 'yellow'
}

interface DogStatsGridProps {
  /** 2 또는 4개. */
  stats: DogStat[]
}

const TONE_COLOR: Record<NonNullable<DogStat['tone']>, string> = {
  ink: V3.ink,
  sage: V3.sage,
  accent: V3.accent,
  yellow: V3.yellow,
}

export default function DogStatsGrid({ stats }: DogStatsGridProps) {
  if (stats.length === 0) return null

  return (
    <section style={{ padding: '0 20px 28px' }}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}
      >
        {stats.map((t) => (
          <div
            key={t.key}
            className="ft-card-v3"
            style={{ padding: '14px 14px' }}
          >
            <Mono color="inkMute" size="xs" weight={500}>
              {t.key}
            </Mono>
            <div
              className="flex items-baseline"
              style={{ marginTop: 10, gap: 6 }}
            >
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 30,
                  color: t.tone ? TONE_COLOR[t.tone] : V3.ink,
                  letterSpacing: '-0.035em',
                  lineHeight: 1,
                }}
              >
                {t.value}
              </span>
              <Mono color="inkMute" size="xs" weight={500}>
                {t.sub}
              </Mono>
            </div>
            {t.trend && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: `1px solid ${V3.rule}`,
                  fontFamily:
                    "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10.5,
                  color: V3.inkSoft,
                  letterSpacing: 0.6,
                }}
              >
                {t.trend}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
