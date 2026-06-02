/**
 * AnalysisStickySummary — 스크롤 시 상단에 고정되는 핵심 요약 (kcal / g / BCS).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import { Scale } from 'lucide-react'

type Props = {
  merKcal: number
  feedG: number
  bcsLabel: string
  analysisDate: string
}

export default function AnalysisStickySummary({
  merKcal,
  feedG,
  bcsLabel,
  analysisDate,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-0 mt-2 px-5 py-2.5 bg-bg/85 backdrop-blur-md border-y border-rule">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10.5px] text-text">
          <span className="inline-flex items-center gap-1 font-bold">
            <span className="text-terracotta font-black">
              {merKcal.toLocaleString()}
            </span>
            <span className="text-[9px] text-muted">kcal</span>
          </span>
          <span className="w-px h-3 bg-rule-2" />
          <span className="inline-flex items-center gap-1 font-bold">
            <Scale className="w-3 h-3 text-moss" strokeWidth={2.5} />
            {feedG}g
          </span>
          <span className="w-px h-3 bg-rule-2" />
          <span className="font-semibold text-muted">
            {bcsLabel}
          </span>
        </div>
        <span className="text-[10.5px] font-bold text-muted">
          {analysisDate}
        </span>
      </div>
    </div>
  )
}
