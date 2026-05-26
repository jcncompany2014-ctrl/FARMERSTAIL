'use client'

/**
 * XL-3 (#12) — Client UI for diet simulation.
 *
 * - 4 default scenarios + custom panel (slider)
 * - 30일 trajectory (SVG line chart) per scenario
 * - 비교 카드: predicted BCS / weight / Bristol + verdict color
 */
import { useMemo, useState } from 'react'
import {
  defaultDietScenarios,
  simulateScenario,
  simulateTrajectory,
  type DietSimBaseline,
  type DietSimScenario,
} from '@/lib/diet-simulation'

interface Props {
  dogName: string
  baseline: DietSimBaseline
}

export default function SimulateClient({ dogName, baseline }: Props) {
  const [activeId, setActiveId] = useState<string>('protein_up')
  const [custom, setCustom] = useState<DietSimScenario>({
    id: 'custom',
    label: '사용자 설정',
    description: '슬라이더로 매크로·운동을 조정합니다.',
    proteinDelta: 0,
    fatDelta: 0,
    carbDelta: 0,
    fiberDelta: 0,
    snackDelta: 0,
    walkMinutesDelta: 0,
  })

  const scenarios = useMemo(() => [...defaultDietScenarios(), custom], [custom])
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]!
  const outcome = useMemo(
    () => simulateScenario(baseline, active),
    [baseline, active],
  )
  const trajectory = useMemo(
    () => simulateTrajectory(baseline, active),
    [baseline, active],
  )

  return (
    <div className="mt-6 space-y-6">
      {/* Baseline 요약 */}
      <section className="rounded border border-line bg-paperHi p-4">
        <h2 className="text-[11px] uppercase tracking-widest text-mute font-semibold mb-2">
          현재 상태 (Baseline)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="체중" value={`${baseline.weightKg.toFixed(1)} kg`} />
          <Stat label="BCS" value={`${baseline.bcs} / 9`} />
          <Stat label="MER" value={`${baseline.mer.toFixed(0)} kcal/일`} />
          <Stat label="단백질" value={`${baseline.proteinPct.toFixed(0)}%`} />
        </div>
      </section>

      {/* 시나리오 선택 */}
      <section>
        <h2 className="text-[11px] uppercase tracking-widest text-mute font-semibold mb-2">
          시나리오 선택
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`text-left p-3 rounded border ${
                activeId === s.id
                  ? 'border-terracotta bg-terracotta/5'
                  : 'border-line hover:border-ink/40'
              }`}
              type="button"
            >
              <div className="text-sm font-semibold text-ink">{s.label}</div>
              <div className="text-xs text-mute mt-0.5">{s.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Custom 슬라이더 (active=custom 일 때만) */}
      {activeId === 'custom' && (
        <section className="rounded border border-line p-4 space-y-3">
          <h3 className="text-sm font-semibold text-ink">사용자 설정</h3>
          <SliderRow
            label="단백질 변화"
            value={custom.proteinDelta ?? 0}
            min={-10}
            max={10}
            unit="%p"
            onChange={(v) => setCustom({ ...custom, proteinDelta: v })}
          />
          <SliderRow
            label="지방 변화"
            value={custom.fatDelta ?? 0}
            min={-10}
            max={10}
            unit="%p"
            onChange={(v) => setCustom({ ...custom, fatDelta: v })}
          />
          <SliderRow
            label="탄수화물 변화"
            value={custom.carbDelta ?? 0}
            min={-10}
            max={10}
            unit="%p"
            onChange={(v) => setCustom({ ...custom, carbDelta: v })}
          />
          <SliderRow
            label="섬유 변화"
            value={custom.fiberDelta ?? 0}
            min={-5}
            max={5}
            unit="%p"
            onChange={(v) => setCustom({ ...custom, fiberDelta: v })}
          />
          <SliderRow
            label="간식 빈도 변화"
            value={custom.snackDelta ?? 0}
            min={-3}
            max={3}
            unit="회/일"
            onChange={(v) => setCustom({ ...custom, snackDelta: v })}
          />
          <SliderRow
            label="산책 시간 변화"
            value={custom.walkMinutesDelta ?? 0}
            min={-30}
            max={60}
            unit="분/일"
            onChange={(v) => setCustom({ ...custom, walkMinutesDelta: v })}
          />
        </section>
      )}

      {/* 결과 */}
      <section
        className={`rounded border p-4 ${
          outcome.verdict === 'risk'
            ? 'border-sale bg-sale/5'
            : outcome.verdict === 'improvement'
              ? 'border-moss bg-moss/5'
              : 'border-line bg-paperHi'
        }`}
      >
        <h2 className="text-[11px] uppercase tracking-widest text-mute font-semibold mb-2">
          {dogName} · 30일 후 예상
        </h2>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <ResultStat
            label="예상 체중"
            value={`${outcome.predictedWeightKg.toFixed(1)} kg`}
            delta={`${formatSigned(outcome.predictedWeightKg - baseline.weightKg)} kg`}
          />
          <ResultStat
            label="예상 BCS"
            value={`${outcome.predictedBcs}`}
            delta={`${formatSigned(outcome.predictedBcs - baseline.bcs)}`}
          />
          <ResultStat
            label="예상 Bristol"
            value={`${outcome.predictedBristol}`}
            delta={`${formatSigned(outcome.predictedBristol - (baseline.bristol ?? 4))}`}
          />
        </div>
        <p className="mt-3 text-sm text-ink leading-relaxed">
          {outcome.verdictReason}
        </p>
        <p className="mt-2 text-[10.5px] text-mute">
          누적 칼로리 변화: {formatSigned(outcome.cumulativeKcalDelta)} kcal (30일)
        </p>
      </section>

      {/* Trajectory chart */}
      <section className="rounded border border-line p-4">
        <h2 className="text-[11px] uppercase tracking-widest text-mute font-semibold mb-3">
          30일 체중 추이 (예상)
        </h2>
        <TrajectoryChart
          trajectory={trajectory}
          baselineWeight={baseline.weightKg}
        />
      </section>

      <p className="text-[10.5px] text-mute leading-relaxed">
        ※ 본 시뮬레이션은 견 종·연령·대사 차이로 실측과 ±30% 변동할 수 있는
        추정치입니다. 의료 진단을 대체하지 않으며, 큰 식단 변경 전에는 수의사
        상담을 권합니다.
      </p>
    </div>
  )
}

// ─── sub components ───

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-mute">
        {label}
      </div>
      <div className="text-base font-semibold text-ink">{value}</div>
    </div>
  )
}

function ResultStat({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta: string
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-mute">
        {label}
      </div>
      <div className="text-lg font-semibold text-ink">{value}</div>
      <div className="text-[11px] text-mute mt-0.5">{delta}</div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-ink">{label}</span>
        <span className="text-xs text-mute font-mono">
          {formatSigned(value)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-terracotta"
      />
    </label>
  )
}

function TrajectoryChart({
  trajectory,
  baselineWeight,
}: {
  trajectory: Array<{ day: number; weightKg: number; bcs: number }>
  baselineWeight: number
}) {
  if (trajectory.length === 0) return null
  const weights = trajectory.map((p) => p.weightKg)
  const minW = Math.min(...weights, baselineWeight) - 0.5
  const maxW = Math.max(...weights, baselineWeight) + 0.5
  const range = maxW - minW || 1
  const W = 600
  const H = 140
  const points = trajectory
    .map((p, i) => {
      const x = (p.day / 30) * (W - 30) + 25
      const y = H - ((p.weightKg - minW) / range) * (H - 30) - 15
      return `${x},${y}`
    })
    .join(' ')

  // baseline horizontal line
  const baselineY =
    H - ((baselineWeight - minW) / range) * (H - 30) - 15

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-32 text-ink"
    >
      {/* y axis labels */}
      <text x={2} y={H - 12} fontSize={9} fill="currentColor" opacity={0.5}>
        {minW.toFixed(1)} kg
      </text>
      <text x={2} y={14} fontSize={9} fill="currentColor" opacity={0.5}>
        {maxW.toFixed(1)} kg
      </text>
      {/* baseline line */}
      <line
        x1={25}
        y1={baselineY}
        x2={W - 5}
        y2={baselineY}
        stroke="currentColor"
        strokeWidth={0.6}
        strokeDasharray="4 3"
        opacity={0.3}
      />
      <text
        x={W - 65}
        y={baselineY - 3}
        fontSize={9}
        fill="currentColor"
        opacity={0.5}
      >
        현재 {baselineWeight.toFixed(1)}kg
      </text>
      {/* trajectory polyline */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        points={points}
      />
      {/* dots */}
      {trajectory.map((p, i) => {
        const x = (p.day / 30) * (W - 30) + 25
        const y = H - ((p.weightKg - minW) / range) * (H - 30) - 15
        return <circle key={i} cx={x} cy={y} r={2.2} fill="currentColor" />
      })}
      {/* x axis ticks */}
      {[0, 10, 20, 30].map((d) => {
        const x = (d / 30) * (W - 30) + 25
        return (
          <text
            key={d}
            x={x}
            y={H - 2}
            fontSize={9}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.5}
          >
            {d}일
          </text>
        )
      })}
    </svg>
  )
}

function formatSigned(n: number): string {
  if (n === 0) return '0'
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(Math.abs(n) < 10 ? 1 : 0)
}
