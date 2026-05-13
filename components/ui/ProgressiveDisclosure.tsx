'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * ProgressiveDisclosure — 부정적 정보의 3단계 점진 공개 컴포넌트.
 *
 * docs/voice-guidelines.md §4 정책. 비만·저체중·식이 문제 같은 부정적
 * 정보는 한 번에 다 보여주면 견주가 거부감을 느낀다. 1→2→3단계로 사용자가
 * "더 알아보기" 클릭할 때만 점진 공개.
 *
 * 사용
 * ────
 *   <ProgressiveDisclosure
 *     level1="초롱이를 위한 새로운 식단을 제안해 드릴게요"
 *     level2="현재 약간 이상 체중을 넘어선 상태예요. 새 식단으로 조정해보면 어떨까요?"
 *     level3={
 *       <>
 *         <p>BCS 점수 7/9 (이상 체중 약 8% 초과)</p>
 *         <p>NRC 권장 칼로리 850kcal/일 → 800kcal/일 (-6%)</p>
 *         <p className="text-muted">출처: NRC 2006, WSAVA 가이드라인</p>
 *       </>
 *     }
 *   />
 *
 * # 가이드
 * - level1 : 견 주어 + 긍정 톤. "제안" / "안내" 같은 부드러운 동사
 * - level2 : 상황 한 줄 설명. 부드러운 표현 유지
 * - level3 : 구체 수치 + 학술 근거. 받아들일 준비된 견주만 봄
 *
 * # 표시 빈도 적응
 * 같은 카드를 N번 연속 level1 에서 닫으면, 다음 회차엔 level2 까지만 보일
 * 수도 있음 (TODO: 다음 phase). 지금은 단순 3단계 노출.
 */
export default function ProgressiveDisclosure({
  level1,
  level2,
  level3,
  className = '',
}: {
  level1: React.ReactNode
  level2: React.ReactNode
  level3?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState<0 | 1 | 2>(0)

  return (
    <div className={className}>
      <p className="text-[13px] leading-relaxed text-text">{level1}</p>

      {open >= 1 && (
        <div
          className="mt-3 pt-3"
          style={{
            borderTop: '1px solid var(--rule)',
          }}
        >
          <p className="text-[12.5px] leading-relaxed text-text">{level2}</p>
        </div>
      )}

      {open >= 2 && level3 && (
        <div
          className="mt-3 pt-3 text-[11.5px] leading-relaxed"
          style={{
            borderTop: '1px solid var(--rule)',
            color: 'var(--muted)',
          }}
        >
          {level3}
        </div>
      )}

      {/* 다음 단계 expand 트리거 */}
      {open === 0 && (
        <button
          type="button"
          onClick={() => setOpen(1)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:text-text transition"
        >
          자세히 알아볼게요
          <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
      {open === 1 && level3 && (
        <button
          type="button"
          onClick={() => setOpen(2)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:text-text transition"
        >
          구체적 근거 보기
          <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
