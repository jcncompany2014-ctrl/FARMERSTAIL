/**
 * AnalysisStickySummary — 스크롤 시 상단에 고정되는 핵심 요약 (kcal / g / BCS)
 * + 분석 결과 공유 버튼.
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출.
 * R-feel(2026-06-10): 상단 뒤로가기를 헤더 ← 로 옮기면서 AnalysisTopNav 가
 * 공유 버튼만 남아 '빈 띠'가 됐던 문제 → 공유 버튼을 이 요약 바로 통합하고
 * AnalysisTopNav 제거. 헤더 바로 아래 빈 공간 사라짐.
 */
'use client'

import { Scale, Share2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'

type Props = {
  dogName: string
  merKcal: number
  feedG: number
  bcsLabel: string
  analysisDate: string
  /**
   * 설문 직후(fromSurvey) 화면 상단에 토스식 고정바(높이 56 + safe-area)가
   * 있을 때 true — 요약 바의 sticky 기준점을 그 아래로 내려 겹침을 막는다.
   */
  stickyBelowBar?: boolean
}

export default function AnalysisStickySummary({
  dogName,
  merKcal,
  feedG,
  bcsLabel,
  analysisDate,
  stickyBelowBar = false,
}: Props) {
  const toast = useToast()

  async function handleShare() {
    const text = `${petName(dogName)}의 맞춤 영양 분석\n\n• 하루 에너지 ${merKcal.toLocaleString()} kcal\n• 급여량 ${feedG}g/일\n• 체형 ${bcsLabel}\n\n파머스테일 · Farm to Tail`
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
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // share 경로와 동일하게 보호 — 비-HTTPS·권한 거부 시 writeText 가 reject
      // 하면 unhandled promise rejection 이 되므로 catch 해 사용자에 안내.
      try {
        await navigator.clipboard.writeText(`${text}\n${shareData.url}`)
        toast.success('분석 요약을 복사했어요')
      } catch {
        toast.error('공유하지 못했어요')
      }
    } else {
      // ★두 경로가 다 없으면 **아무 일도 일어나지 않았다**(2026-08-05).
      //   share 도 clipboard 도 보안 컨텍스트·브라우저에 따라 없을 수 있는데
      //   else 가 없어서 버튼을 눌러도 화면이 그대로였다 — 고객에게 무반응은
      //   고장과 구분되지 않는다. 실패는 실패라고 말한다.
      toast.info('이 브라우저에서는 공유가 안 돼요. 주소창의 링크를 복사해 주세요')
    }
  }

  return (
    <div
      className="sticky z-30 -mx-0 mt-2 px-5 py-2.5 bg-bg/85 backdrop-blur-md border-y border-rule"
      style={{
        top: stickyBelowBar ? 'calc(env(safe-area-inset-top) + 56px)' : 0,
      }}
    >
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
          <span className="font-semibold text-muted">{bcsLabel}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[10.5px] font-bold text-muted">
            {analysisDate}
          </span>
          <button
            type="button"
            onClick={handleShare}
            aria-label="분석 결과 공유"
            className="inline-flex items-center text-muted hover:text-terracotta transition active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  )
}
