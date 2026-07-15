/**
 * AnalysisCTASection — 분석 페이지 하단 CTA (정기배송 신청 / 다시 분석 / 히스토리).
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
}

export default function AnalysisCTASection({
  dogId,
  dogName,
  isArchive,
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
          {/* 목적지 = 플랜(레시피 고르는 단계). /order 로 직행시키면 상단
              스텝바가 '레시피 → 배송 → 결제' 인데 레시피를 건너뛴 채 배송에
              떨어지고, 무엇보다 고른 레시피(?recipes=)가 없어서 주문 화면이
              제멋대로 보였다 (사장님 2026-07-15). RecommendationBox 도 /plan
              으로 가므로 목적지 통일. */}
          <Link
            href={`/dogs/${dogId}/plan`}
            className="flex items-center justify-center gap-1.5 w-full py-4 rounded bg-ink text-bg text-[13.5px] font-bold active:scale-[0.98] transition"
          >
            {dogName} 맞춤 정기배송 신청하기
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
          <Link
            href={`/dogs/${dogId}/survey`}
            className="block w-full py-3 text-center rounded bg-bg-3 text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
          >
            다시 분석하기
          </Link>
          {/* '이전 분석 히스토리' 버튼은 여기서 제거 — 페이지 최하단에 눈에 덜
              띄는 텍스트 링크로 내림(2026-07-14 사장님). AnalysisView 참고. */}
        </>
      )}
    </section>
  )
}
