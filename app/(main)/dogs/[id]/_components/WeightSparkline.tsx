import type { WeightLog } from './types'
import { V3, V3Radius } from '@/lib/design/tokens'

/**
 * Tiny SVG sparkline of recent weight readings.
 * Receives logs in newest-first order; we reverse for left-to-right time axis.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 AppDog '체중 기록'): 먹색 선 2.5 하나 + 마지막 점(머스타드 동그라미 ·
 * 먹선 2). 면 채우기·최저/최고 글자는 뺐다 — 숫자는 바로 아래 기록 목록이 말한다.
 */
export default function WeightSparkline({ logs }: { logs: WeightLog[] }) {
  const series = [...logs].reverse()
  if (series.length < 2) {
    return (
      <div
        style={{
          height: 70,
          borderRadius: V3Radius.sm,
          background: V3.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 14, color: V3.inkMute }}>기록이 2개 이상 쌓이면 추이가 보여요</span>
      </div>
    )
  }

  const W = 350
  const H = 70
  // 위아래 여백 — 마지막 점(반지름 5 + 선 2)이 잘리지 않게.
  const PAD_Y = 8
  const PAD_RIGHT = 7
  const weights = series.map((s) => s.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  // 세로 눈금 — 최저~최고를 칸 전체로 늘리면 0.1kg 오르내림도 큰 파도처럼 보인다(시안은 거의 평평한 선).
  // 체중의 10% 를 최소 폭으로 두고 가운데 맞춘다 — 11kg 아이의 0.2kg 는 낮은 물결, 3kg 아이의 0.3kg 는 또렷하게.
  const mid = (min + max) / 2
  const span = Math.max(max - min, mid * 0.1, 0.1)
  const lo = mid - span / 2

  const points = series.map((s, i) => {
    const x = (i * (W - PAD_RIGHT)) / (series.length - 1)
    const y = H - PAD_Y - ((s.weight - lo) / span) * (H - PAD_Y * 2)
    return { x, y, v: s.weight }
  })
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]!

  // SVG 는 시각 전용 — 스크린리더용으로 추세를 한 줄 요약(role=img + aria-label).
  const first = series[0]!.weight
  const trend = last.v > first ? '증가' : last.v < first ? '감소' : '유지'
  const ariaLabel = `체중 추이 그래프: 최근 ${series.length}개 기록, ${first}kg에서 ${last.v}kg으로 ${trend} (최저 ${min}kg · 최고 ${max}kg)`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={V3.ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r="5" fill={V3.mustard} stroke={V3.ink} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
