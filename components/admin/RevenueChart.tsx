/**
 * RevenueChart — 외부 차트 lib 없이 inline SVG 로 그리는 일별 매출 라인.
 *
 * 입력: { date: 'YYYY-MM-DD', revenue: number }[]  (오름차순)
 * 동작:
 *   - 0 ~ max 사이로 normalize 해서 polyline 그리기
 *   - x 축 점 6 ~ 8 개 라벨 (균등 간격)
 *   - y 축은 max / 0 두 단위만 — 깔끔
 *   - 데이터 비면 placeholder
 *
 * 디자인:
 *   - 부드러운 line + area fill
 *   - 호버 dot — CSS hover 로 last point 강조
 */

export type RevenuePoint = {
  date: string
  revenue: number
}

const W = 720
const H = 220
const PAD = { top: 24, right: 24, bottom: 28, left: 56 }

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${Math.round(n / 1_000_000) / 100}억`
  if (n >= 10_000) return `${Math.round(n / 1_000) / 10}만`
  if (n >= 1_000) return `${Math.round(n / 100) / 10}천`
  return n.toLocaleString('ko-KR')
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}.${parseInt(d, 10)}`
}

export default function RevenueChart({
  data,
  title = '일별 매출 (최근 30일)',
}: {
  data: RevenuePoint[]
  title?: string
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-rule p-6">
        <h2 className="text-sm font-bold text-ink mb-1">{title}</h2>
        <p className="text-[12px] text-muted">데이터가 아직 없어요.</p>
      </div>
    )
  }

  const max = Math.max(1, ...data.map((d) => d.revenue))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xAt = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yAt = (v: number) => PAD.top + innerH - (v / max) * innerH

  // line points
  const linePoints = data
    .map((p, i) => `${xAt(i)},${yAt(p.revenue)}`)
    .join(' ')

  // area path — line + bottom corners
  const areaPath =
    `M ${xAt(0)},${yAt(0)} ` +
    data.map((p, i) => `L ${xAt(i)},${yAt(p.revenue)}`).join(' ') +
    ` L ${xAt(data.length - 1)},${yAt(0)} Z`

  // x-axis label index — 균등 간격 6개
  const labelCount = Math.min(7, data.length)
  const labelIdx = Array.from({ length: labelCount }, (_, k) =>
    Math.round((k / (labelCount - 1 || 1)) * (data.length - 1)),
  )

  // 어제까지 합계 / 평균
  const total = data.reduce((s, p) => s + p.revenue, 0)
  const avg = Math.round(total / data.length)
  const lastPoint = data[data.length - 1]

  return (
    <div className="rounded-2xl bg-white border border-rule p-5 md:p-6">
      <div className="flex items-end justify-between mb-3 md:mb-4 gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <p className="text-[11px] text-muted mt-0.5">
            합계 {total.toLocaleString('ko-KR')}원 · 평균 {avg.toLocaleString('ko-KR')}원
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted font-mono">
            {data[0].date} ~ {lastPoint.date}
          </div>
          <div className="text-[16px] md:text-[20px] font-bold text-ink font-mono tabular-nums">
            {lastPoint.revenue.toLocaleString('ko-KR')}원
          </div>
          <div className="text-[10px] text-muted">{shortDate(lastPoint.date)}</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-auto"
        role="img"
        aria-label={`${title} — 합계 ${total.toLocaleString('ko-KR')}원`}
      >
        {/* y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + innerH - innerH * t
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y}
                y2={y}
                stroke="#E5DCC9"
                strokeWidth={1}
                strokeDasharray={t === 0 ? '0' : '3,4'}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#7B6F5C"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatKRW(max * t)}
              </text>
            </g>
          )
        })}

        {/* area fill */}
        <path d={areaPath} fill="rgba(160,69,46,0.12)" />

        {/* line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#A0452E"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* points */}
        {data.map((p, i) => (
          <circle
            key={p.date}
            cx={xAt(i)}
            cy={yAt(p.revenue)}
            r={i === data.length - 1 ? 4 : 2.5}
            fill={i === data.length - 1 ? '#A0452E' : '#FFF'}
            stroke="#A0452E"
            strokeWidth={1.5}
          />
        ))}

        {/* x labels */}
        {labelIdx.map((i) => (
          <text
            key={`xl-${i}`}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#7B6F5C"
            fontFamily="JetBrains Mono, monospace"
          >
            {shortDate(data[i].date)}
          </text>
        ))}
      </svg>
    </div>
  )
}
