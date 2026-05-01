/**
 * CategoryRevenueDonut — 외부 차트 lib 없이 inline SVG 도넛 차트.
 *
 * 입력: { category, revenue }[] (raw — 정렬 / 비율 계산은 컴포넌트가 알아서)
 * 동작:
 *   - revenue 합계 0 이면 placeholder
 *   - 카테고리 ≤ 6개 가정 — 더 많으면 상위 5 + "기타" 로 합침
 *   - SVG arc path stroke 로 도넛 — fill 없이 ring 만 그려 가벼움
 *   - 색상은 브랜드 토큰 cycle (terracotta / moss / gold / ink / muted)
 *   - 우측 legend — 카테고리 / 비율 / 절대값
 *
 * 디자인:
 *   - 가운데 큰 숫자 = 총 매출. KRW 한국어 단위 (만 / 억).
 */

export type CategoryRevenuePoint = {
  category: string
  revenue: number
}

const COLORS = [
  'var(--terracotta)',
  'var(--moss)',
  'var(--gold)',
  'var(--ink)',
  '#8BA05A',
  'var(--muted)',
] as const

const SIZE = 200
const STROKE = 28
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${Math.round(n / 1_000_000) / 100}억`
  if (n >= 10_000_000) return `${Math.round(n / 100_000) / 10}백만`
  if (n >= 10_000) return `${Math.round(n / 1_000) / 10}만`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}천`
  return n.toLocaleString('ko-KR')
}

export default function CategoryRevenueDonut({
  data,
  title = 'Category · 카테고리별 매출',
}: {
  data: CategoryRevenuePoint[]
  title?: string
}) {
  // 0 매출 / 빈 카테고리 정리 + 정렬.
  const sorted = data
    .filter((d) => d.revenue > 0 && d.category)
    .sort((a, b) => b.revenue - a.revenue)

  // 6 초과 시 상위 5 + 기타 합산.
  const displayed: CategoryRevenuePoint[] =
    sorted.length > 6
      ? [
          ...sorted.slice(0, 5),
          {
            category: '기타',
            revenue: sorted.slice(5).reduce((s, x) => s + x.revenue, 0),
          },
        ]
      : sorted

  const total = displayed.reduce((s, d) => s + d.revenue, 0)

  if (total === 0) {
    return (
      <section className="bg-white rounded-xl border border-rule p-5">
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest mb-4">
          {title}
        </h3>
        <p className="text-[13px] text-muted">
          아직 매출 데이터가 없어요.
        </p>
      </section>
    )
  }

  // 각 segment 의 stroke-dasharray + offset 계산.
  // CIRC * (revenue / total) = arc 길이.
  let cumulative = 0
  const segments = displayed.map((d, i) => {
    const ratio = d.revenue / total
    const length = CIRC * ratio
    const segment = {
      key: d.category,
      color: COLORS[i % COLORS.length],
      length,
      offset: cumulative,
      ratio,
      revenue: d.revenue,
    }
    cumulative += length
    return segment
  })

  return (
    <section className="bg-white rounded-xl border border-rule p-5">
      <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest mb-4">
        {title}
      </h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* 도넛 SVG */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            // -90deg 회전 — segment 가 12시 방향에서 시작.
            style={{ transform: 'rotate(-90deg)' }}
            role="img"
            aria-label={`${title} 도넛 차트`}
          >
            {/* 배경 ring */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--rule)"
              strokeWidth={STROKE}
            />
            {/* 각 segment */}
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={`${seg.length} ${CIRC}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          {/* 가운데 총합 — SVG 회전 영향 안 받게 별도 div */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            aria-hidden
          >
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
              Total
            </p>
            <p
              className="font-serif text-[22px] font-black mt-0.5"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {formatKRW(total)}
            </p>
            <p className="text-[10px] text-muted mt-0.5">원</p>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex-1 w-full space-y-2 self-stretch">
          {segments.map((seg) => (
            <li
              key={seg.key}
              className="flex items-center gap-3 text-[13px]"
            >
              <span
                aria-hidden
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: seg.color }}
              />
              <span className="flex-1 font-bold text-text truncate">
                {seg.key}
              </span>
              <span className="font-mono text-[11px] text-muted tabular-nums">
                {(seg.ratio * 100).toFixed(1)}%
              </span>
              <span className="font-bold text-text tabular-nums shrink-0 w-20 text-right">
                {formatKRW(seg.revenue)}원
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
