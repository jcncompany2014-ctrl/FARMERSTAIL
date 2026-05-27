/**
 * AnalysisTopNav — 분석 페이지 최상단 영역. 뒤로 가기 link + 공유 button.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 동일.
 */
'use client'

import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Props = {
  dogId: string
  dogName: string
  isArchive: boolean
  analysisMerKcal: number
  analysisFeedG: number
  analysisBcsLabel: string
}

export default function AnalysisTopNav({
  dogId,
  dogName,
  isArchive,
  analysisMerKcal,
  analysisFeedG,
  analysisBcsLabel,
}: Props) {
  const toast = useToast()

  return (
    <section className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
      <Link
        href={isArchive ? `/dogs/${dogId}/analyses` : `/dogs/${dogId}`}
        className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
      >
        ← {isArchive ? '분석 히스토리' : dogName}
      </Link>
      <button
        onClick={async () => {
          const text = `${dogName}의 맞춤 영양 분석\n\n• 하루 에너지 ${analysisMerKcal.toLocaleString()} kcal\n• 급여량 ${analysisFeedG}g/일\n• 체형 ${analysisBcsLabel}\n\n파머스테일 · Farm to Tail`
          const shareData = {
            title: `${dogName} 영양 분석 · 파머스테일`,
            text,
            url: typeof window !== 'undefined' ? window.location.href : '',
          }
          if (typeof navigator !== 'undefined' && navigator.share) {
            try {
              await navigator.share(shareData)
            } catch {
              /* 사용자 취소 */
            }
          } else if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard
          ) {
            await navigator.clipboard.writeText(`${text}\n${shareData.url}`)
            toast.success('분석 요약을 복사했어요')
          }
        }}
        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta font-semibold transition-colors"
        aria-label="분석 결과 공유"
      >
        <Share2 className="w-3 h-3" strokeWidth={2.5} />
        공유
      </button>
    </section>
  )
}
