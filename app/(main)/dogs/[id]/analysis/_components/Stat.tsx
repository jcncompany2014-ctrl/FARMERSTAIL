/**
 * Stat — Daily Energy 카드 (legacy 폐기) 의 2-column metric pair.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 * 현재 호출부는 `style={{ display: 'none' }}` legacy block 안에만 있음.
 */
'use client'

export default function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-[0.2em]">
        {label}
      </div>
      <div className="text-[13px] font-black text-text mt-0.5">
        {value}
      </div>
    </div>
  )
}
