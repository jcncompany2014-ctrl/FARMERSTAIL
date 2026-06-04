/**
 * AnalysisEmptyState — 분석 데이터가 없을 때 (또는 fetch 실패 후) 표시.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

export default function AnalysisEmptyState({ dogId }: { dogId: string }) {
  return (
    <div className="px-5 py-6 max-w-md mx-auto">
      <Link
        href={`/dogs/${dogId}`}
        className="text-[10.5px] text-muted hover:text-terracotta font-semibold"
      >
        ← 돌아가기
      </Link>
      <div className="mt-6 text-center bg-bg-3 rounded border border-dashed border-rule-2 px-5 py-10">
        <ClipboardList
          className="w-10 h-10 text-muted mx-auto mb-4"
          strokeWidth={1.2}
        />
        <h3 className="font-sans font-black text-[16px] text-text">
          분석 결과가 없어요
        </h3>
        <p className="text-[12px] text-muted mt-2 leading-relaxed">
          설문을 완료하면
          <br />
          맞춤 영양 분석을 받아볼 수 있어요
        </p>
        <Link
          href={`/dogs/${dogId}/survey`}
          className="inline-flex items-center gap-1 mt-5 px-5 py-2.5 bg-terracotta text-white rounded text-[12px] font-bold active:scale-[0.98] transition"
        >
          설문 시작하기
        </Link>
      </div>
    </div>
  )
}
