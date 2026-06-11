/**
 * AnalysisArchiveBanner — 과거 분석 히스토리 모드일 때 표시되는 안내 배너.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import Link from 'next/link'
import { History } from 'lucide-react'

type Props = {
  dogId: string
  analysisDate: string
}

export default function AnalysisArchiveBanner({ dogId, analysisDate }: Props) {
  return (
    <section className="px-5 mt-3">
      <div className="bg-text/5 border border-text/15 rounded px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10.5px] text-text min-w-0">
          <History className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          <span className="font-bold truncate">
            {analysisDate} 기록 · 과거 분석 보기
          </span>
        </div>
        <Link
          href={`/dogs/${dogId}/analysis`}
          className="shrink-0 text-[10.5px] font-bold text-terracotta"
        >
          최신 분석 →
        </Link>
      </div>
    </section>
  )
}
