/**
 * RevenueChart — 외부 차트 lib 없이 inline SVG 로 그리는 일별 매출 라인.
 *
 * 입력: { date: 'YYYY-MM-DD', revenue: number }[]  (오름차순)
 * 동작:
 *   - 0 ~ max 사이로 normalize 해서 polyline 그리기
 *   - x 축 점 4 ~ 7 개 라벨 (균등 간격)
 *   - y 축은 0 · 중간 · max 세 단위만 — 깔끔
 *   - 데이터 비면 placeholder
 *
 * 반응형 (2026-09-05 전수감사):
 *   viewBox 720 하나로 그리면 375px 폰에서 전체가 ~0.47배 균등 축소돼
 *   축 라벨 11px 가 실제 ~5px 로 렌더되고, 고정 높이 200px 박스 안에
 *   ~102px 그림이 떠서 위아래가 빈 공간이 됐다. 폰/데스크톱 두 viewBox 를
 *   각각 그려 md 브레이크포인트로 토글한다(측정용 클라이언트 JS 불필요).
 *
 * 색 (2026-09-05 어드민 개편): 사이트 hex(#A0452E 등) → --adm-* 토큰.
 */

export type RevenuePoint = {
  date: string
  revenue: number
}

const H = 220

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

/** 한 폭(viewBox 좌표계)에 대한 차트 SVG — 폰(360)·데스크톱(720) 두 벌 렌더. */
function ChartSvg({
  data,
  max,
  w,
  labelCount,
  className,
  ariaLabel,
}: {
  data: RevenuePoint[]
  max: number
  w: number
  labelCount: number
  className: string
  ariaLabel: string
}) {
  const pad = {
    top: 24,
    right: w >= 720 ? 24 : 14,
    bottom: 28,
    left: w >= 720 ? 56 : 44,
  }
  const innerW = w - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const xAt = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yAt = (v: number) => pad.top + innerH - (v / max) * innerH

  const linePoints = data
    .map((p, i) => `${xAt(i)},${yAt(p.revenue)}`)
    .join(' ')

  const areaPath =
    `M ${xAt(0)},${yAt(0)} ` +
    data.map((p, i) => `L ${xAt(i)},${yAt(p.revenue)}`).join(' ') +
    ` L ${xAt(data.length - 1)},${yAt(0)} Z`

  const count = Math.min(labelCount, data.length)
  const labelIdx = Array.from({ length: count }, (_, k) =>
    Math.round((k / (count - 1 || 1)) * (data.length - 1)),
  )

  const lastPoint = data[data.length - 1]!

  return (
    <svg
      viewBox={`0 0 ${w} ${H}`}
      className={className}
      style={{ height: 200 }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* y grid — 눈금 3단계(0·중간·최대). 5단계는 0원대 데이터에서 소수점
          금액을 만들고 시선만 분산시킨다. */}
      {[0, 0.5, 1].map((t) => {
        const y = pad.top + innerH - innerH * t
        return (
          <g key={t}>
            <line
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y}
              y2={y}
              stroke="var(--adm-border)"
              strokeWidth={1}
              strokeDasharray={t === 0 ? '0' : '3,4'}
            />
            <text
              x={pad.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--adm-muted-foreground)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatKRW(max * t)}
            </text>
          </g>
        )
      })}

      {/* area fill */}
      <path d={areaPath} fill="var(--adm-primary)" fillOpacity={0.12} />

      {/* line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--adm-primary)"
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
        fill="var(--adm-primary)"
        stroke="var(--adm-card)"
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
          fill="var(--adm-muted-foreground)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {shortDate(data[i]!.date)}
        </text>
      ))}
    </svg>
  )
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
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {data.length === 0
            ? '데이터가 아직 없어요.'
            : '이 기간에는 결제된 주문이 없어요. 첫 결제가 들어오면 여기에 그래프가 그려져요.'}
        </p>
      </div>
    )
  }

  const max = Math.max(1, ...data.map((d) => d.revenue))
  const total = data.reduce((s, p) => s + p.revenue, 0)
  const avg = Math.round(total / data.length)
  const lastPoint = data[data.length - 1]!
  const ariaLabel = `${title} — 합계 ${total.toLocaleString('ko-KR')}원`

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-end justify-between gap-3 md:mb-4">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            합계 {total.toLocaleString('ko-KR')}원 · 평균{' '}
            {avg.toLocaleString('ko-KR')}원
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] text-muted-foreground tabular-nums">
            {data[0]!.date} ~ {lastPoint.date}
          </div>
          <div className="text-[16px] font-bold tabular-nums md:text-[20px]">
            {lastPoint.revenue.toLocaleString('ko-KR')}원
          </div>
          <div className="text-[10px] text-muted-foreground">
            {shortDate(lastPoint.date)}
          </div>
        </div>
      </div>

      {/* preserveAspectRatio 기본값(meet) + 높이 고정 — 컨테이너 폭에 맞춰
          독립 스케일하면 넓은 화면에서 글씨·선까지 늘어난다(2026-08-10). */}
      <ChartSvg
        data={data}
        max={max}
        w={360}
        labelCount={4}
        className="w-full md:hidden"
        ariaLabel={ariaLabel}
      />
      <ChartSvg
        data={data}
        max={max}
        w={720}
        labelCount={7}
        className="hidden w-full md:block"
        ariaLabel={ariaLabel}
      />
    </div>
  )
}
