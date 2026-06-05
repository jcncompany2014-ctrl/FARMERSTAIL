/**
 * AnalysisCTASection — 분석 페이지 하단 CTA (체험팩 주문 / 다시 분석 / 히스토리).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  dogId: string
  dogName: string
  isArchive: boolean
  totalCount: number
}

export default function AnalysisCTASection({
  dogId,
  dogName,
  isArchive,
  totalCount,
}: Props) {
  return (
    <section className="px-5 mt-5 space-y-2">
      {isArchive ? (
        <>
          <Link
            href={`/dogs/${dogId}/analysis`}
            className="flex items-center justify-center gap-1.5 w-full py-4 rounded bg-ink text-bg text-[13.5px] font-black active:scale-[0.98] transition"
          >
            최신 분석 보기
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
          <Link
            href={`/dogs/${dogId}/analyses`}
            className="block w-full py-3 text-center rounded bg-bg-3 text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
          >
            히스토리 목록
          </Link>
        </>
      ) : (
        <>
          {/* 개인화 박스 주문으로 직행 — /dogs/[id]/order 가 최신 dog_formulas
              를 읽어 추천 SKU·비율·급여량·가격을 그대로 렌더한다. 이전엔
              generic /products 로 보내 방금 만든 개인화를 전부 흘렸음
              (RecommendationBox 의 "정기배송 신청" 과 목적지 통일). */}
          <Link
            href={`/dogs/${dogId}/order`}
            className="flex items-center justify-center gap-1.5 w-full py-4 rounded bg-ink text-bg text-[13.5px] font-bold active:scale-[0.98] transition"
          >
            {dogName} 맞춤 체험팩 주문하기
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
          <Link
            href={`/dogs/${dogId}/survey`}
            className="block w-full py-3 text-center rounded bg-bg-3 text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
          >
            다시 분석하기
          </Link>
          {totalCount > 1 && (
            <Link
              href={`/dogs/${dogId}/analyses`}
              className="block w-full py-3 text-center rounded bg-bg-3 text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
            >
              이전 분석 히스토리 {totalCount}회 →
            </Link>
          )}
        </>
      )}
    </section>
  )
}
