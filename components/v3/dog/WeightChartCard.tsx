/**
 * WeightChartCard — ink 체중 추이 카드 (items 49, 54).
 *
 * 핸드오프 패턴:
 *   - ink-bg + yellow accent
 *   - 좌상단: Mono yellow "체중 추이 · 최근 N개월" + 22px sans 700 본문
 *   - 우상단: 큰 32px sans 800 현재 체중 + Mono 단위 + delta mono yellow
 *   - 본문: 100h Sparkline (yellow + 14% fill)
 *   - 하단: 권장 구간 bar — gray bg + sage 권장 영역 + current dot
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono, Sparkline } from '@/components/v3'

interface WeightChartCardProps {
  /** 현재 체중 (kg). */
  currentKg: number
  /** 9~12개월 trend data (kg). */
  data: number[]
  /** 차트 라벨 — "최근 9개월". */
  rangeLabel?: string
  /** 변화 폭 — "+0.3" / "-0.1". 우상단 작은 mono. */
  deltaKg?: number
  /** 권장 구간 — [low, high] (kg). 옵션 (item 54). */
  recommendedRange?: [number, number]
  /** 차트 헤딩 — 기본 "안정 구간을 유지중". */
  heading?: string
}

export default function WeightChartCard({
  currentKg,
  data,
  rangeLabel = '최근 9개월',
  deltaKg,
  recommendedRange,
  heading = '안정 구간을 유지중',
}: WeightChartCardProps) {
  const safeData = data.length > 0 ? data : [currentKg]
  const deltaSign = deltaKg != null ? (deltaKg > 0 ? '+' : '') : ''

  return (
    <section style={{ padding: '0 20px 30px' }}>
      <div
        className="ft-card-ink"
        style={{ padding: '18px 18px 22px' }}
      >
        <div
          className="flex justify-between items-end"
          style={{ marginBottom: 16, gap: 12 }}
        >
          <div className="min-w-0">
            <Mono color="yellow" size="xs" weight={600}>
              체중 추이 · {rangeLabel}
            </Mono>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 22,
                marginTop: 6,
                color: V3.paper,
                letterSpacing: '-0.025em',
                wordBreak: 'keep-all',
              }}
            >
              {heading}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className="tabular-nums"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 32,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: V3.paper,
              }}
            >
              {currentKg}
            </span>
            <Mono
              color="paper"
              size="sm"
              upper={false}
              letterSpacing="0.04em"
              style={{ marginLeft: 4 }}
            >
              kg
            </Mono>
            {deltaKg != null && (
              <Mono
                color="yellow"
                size="xxs"
                weight={500}
                upper={false}
                letterSpacing="0"
                as="div"
                style={{ marginTop: 4 }}
              >
                {deltaSign}
                {deltaKg.toFixed(1)} / {rangeLabel.replace(/\s/g, '')}
              </Mono>
            )}
          </div>
        </div>

        {/* Sparkline */}
        <div className="relative" style={{ height: 100 }}>
          <Sparkline
            data={safeData}
            width={362}
            height={100}
            color={V3.yellow}
            fill="rgba(230,185,66,0.14)"
            strokeWidth={2}
            lastDot
          />
        </div>

        {/* 권장 구간 bar (item 54) */}
        {recommendedRange && (
          <RecommendedRangeBar
            currentKg={currentKg}
            range={recommendedRange}
          />
        )}
      </div>
    </section>
  )
}

function RecommendedRangeBar({
  currentKg,
  range,
}: {
  currentKg: number
  range: [number, number]
}) {
  // bar 전체 = current ±50% 범위 또는 [range[0]-1, range[1]+1] 중 넓은 값
  const lo = Math.min(range[0] - 1, currentKg - 1)
  const hi = Math.max(range[1] + 1, currentKg + 1)
  const span = Math.max(0.1, hi - lo)
  const sageLeftPct = ((range[0] - lo) / span) * 100
  const sageWidthPct = ((range[1] - range[0]) / span) * 100
  const dotPct = ((currentKg - lo) / span) * 100
  const inRange = currentKg >= range[0] && currentKg <= range[1]

  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 14,
        borderTop: `1px solid var(--ink-rule, rgba(244,237,224,0.18))`,
      }}
    >
      <div className="flex justify-between" style={{ marginBottom: 8 }}>
        <Mono color="paper" size="xxs" weight={500}>
          권장 구간
        </Mono>
        <Mono
          color={inRange ? 'sage' : 'yellow'}
          size="xxs"
          weight={600}
          upper={false}
        >
          {inRange ? '안정' : '주의'} · {range[0]}–{range[1]} kg
        </Mono>
      </div>
      <div
        className="relative"
        style={{
          height: 6,
          background: 'var(--ink-rule, rgba(244,237,224,0.18))',
          borderRadius: 3,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${sageLeftPct}%`,
            top: 0,
            width: `${sageWidthPct}%`,
            height: '100%',
            background: V3.sage,
            borderRadius: 3,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${dotPct}%`,
            top: -3,
            transform: 'translateX(-50%)',
            width: 12,
            height: 12,
            borderRadius: 6,
            background: V3.yellow,
            boxShadow: '0 0 0 2px var(--ink-bg, #16140f)',
          }}
        />
      </div>
    </div>
  )
}
