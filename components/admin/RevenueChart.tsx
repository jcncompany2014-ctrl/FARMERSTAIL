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
  return `${parseInt(m ?? '0', 10)}.${parseInt(d ?? '0', 10)}`
}

export default function RevenueChart({
  data,
  title = '일별 매출 (최근 30일)',
}: {
  data: RevenuePoint[]
  title?: string
}) {
  /**
   * ★"데이터 0개" 뿐 아니라 **전부 0원**도 빈 상태로 (2026-08-10 사장님 제보).
   *
   * 예전엔 30일치가 모두 0이어도 차트를 그렸다. 그러면 아래 max 계산이
   * `Math.max(1, ...)` 이라 **max=1** 이 되어 y축에 `0.25원 · 0.5원 · 0.75원`
   * 같은 눈금이 뜨고, 0 위에 마커 30개가 일렬로 박혔다 — 화면 절반을
   * "아무 정보 없는 그래프"가 차지했다. 매출이 없으면 없다고 말하는 게 맞다.
   */
  const hasAnyRevenue = data.some((d) => d.revenue > 0)
  if (data.length === 0 || !hasAnyRevenue) {
    return (
      <div className="rounded-lg bg-white border border-zinc-200 p-5 md:p-6">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        <p className="mt-1 text-[12px] text-muted">
          {data.length === 0
            ? '데이터가 아직 없어요.'
            : '이 기간에는 결제된 주문이 없어요. 첫 결제가 들어오면 여기에 그래프가 그려져요.'}
        </p>
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
  const lastPoint = data[data.length - 1]!

  return (
    <div className="rounded-lg bg-white border border-zinc-200 p-5 md:p-6">
      <div className="flex items-end justify-between mb-3 md:mb-4 gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          <p className="text-[11px] text-muted mt-0.5">
            합계 {total.toLocaleString('ko-KR')}원 · 평균 {avg.toLocaleString('ko-KR')}원
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] text-muted tabular-nums">
            {data[0]!.date} ~ {lastPoint.date}
          </div>
          <div className="text-[16px] md:text-[20px] font-bold text-ink tabular-nums">
            {lastPoint.revenue.toLocaleString('ko-KR')}원
          </div>
          <div className="text-[10px] text-muted">{shortDate(lastPoint.date)}</div>
        </div>
      </div>

      {/* ★preserveAspectRatio="none" 제거 (2026-08-10).
          컨테이너 폭에 맞춰 x/y 를 **독립 스케일**하던 탓에 넓은 화면에서
          축 글씨와 선 두께까지 함께 늘어나 투박해 보였다(720px 기준 디자인이
          1400px 컨테이너에서 2배). 기본값(xMidYMid meet) + 높이 고정으로
          디자인한 크기 그대로 렌더한다. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200 }}
        role="img"
        aria-label={`${title} — 합계 ${total.toLocaleString('ko-KR')}원`}
      >
        {/* y grid */}
        {/* 눈금 3단계(0·중간·최대) — 5단계는 0원대 데이터에서 소수점 금액을
            만들고 시선만 분산시킨다. */}
        {[0, 0.5, 1].map((t) => {
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
                fontSize={11}
                fill="#9A8F7D"
                style={{ fontVariantNumeric: 'tabular-nums' }}
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

        {/* points — 마지막(오늘)만 강조. 예전엔 30개를 다 찍어 0 위에 원이
            일렬로 늘어섰다. 점이 많으면 추세선이 안 보인다. */}
        <circle
          cx={xAt(data.length - 1)}
          cy={yAt(lastPoint.revenue)}
          r={4}
          fill="#A0452E"
          stroke="#FFF"
          strokeWidth={2}
        />

        {/* x labels */}
        {labelIdx.map((i) => (
          <text
            key={`xl-${i}`}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#9A8F7D"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {shortDate(data[i]!.date)}
          </text>
        ))}
      </svg>
    </div>
  )
}
