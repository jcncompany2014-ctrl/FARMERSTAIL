'use client'

/**
 * /design-check/analysis?s=analysis-* — 실제 분석 화면(AnalysisResultView)에 예시 값을 넣어 그린다. 미리보기 전용.
 * 화식 양 카드는 실제 그리기 부품(RecommendationPanel)에 상태만 바꿔 꽂고, 레시피 고르기 창은 실제 AdjustSheet 를 연다
 * (예시 강아지라 저장은 되지 않는다 — 로그인·권한 없음).
 */

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { AnalysisResultView } from '../../dogs/[id]/analysis/AnalysisView'
import AnalysisEmptyState from '../../dogs/[id]/analysis/_components/AnalysisEmptyState'
import AnalysisLoading from '../../dogs/[id]/analysis/loading'
import { RecommendationPanel, type RecommendationState } from '@/components/analysis/RecommendationBox'
import AdjustSheet from '@/components/analysis/AdjustSheet'
import { ANALYSIS_FIXTURES, DOG_ID, formulaOf } from './_fixtures'

const noop = () => {}

export default function AnalysisDemo({ which }: { which: string }) {
  const fx = ANALYSIS_FIXTURES[which]!
  const toast = useToast()
  const shown = useRef(false)
  useEffect(() => {
    if (!fx.toast || shown.current) return
    shown.current = true
    // AnalysisView 의 한도 안내와 같은 문구(자동으로 사라지지 않게).
    toast.info(
      fx.toast === 'refine'
        ? '추가 답변도 재분석으로 계산돼요. 이번 달 재분석 3회를 모두 써서 다음 달에 이어서 답할 수 있어요. 체중이나 건강 정보가 바뀌었다면 바로 다시 분석할 수 있어요.'
        : '이번 달 재분석 3회를 모두 사용했어요. 다음 달에 다시 할 수 있어요. 체중이나 건강 정보가 바뀌었다면, 정보를 고친 뒤 바로 다시 분석할 수 있어요.',
      { duration: null },
    )
  }, [fx.toast, toast])

  if (fx.loading) return <AnalysisLoading />
  if (fx.empty) return <AnalysisEmptyState dogId={DOG_ID} />

  const sheetLines = fx.sheet ? (['weight', 'basic'] as const) : (['weight', 'joint'] as const)
  const formula = formulaOf([...sheetLines])
  const state: RecommendationState =
    fx.rec === 'ready'
      ? { status: 'ready', formula }
      : fx.rec === 'consultation'
        ? { status: 'consultation', reason: '' }
        : fx.rec === 'error'
          ? { status: 'error', message: '네트워크가 불안정해요. 다시 시도해 주세요.' }
          : fx.rec === 'no_survey'
            ? { status: 'no_survey' }
            : { status: 'loading' }

  return (
    <>
      <AnalysisResultView
        model={fx.model}
        onCloseFocus={noop}
        recommendationOverride={
          <RecommendationPanel
            state={state}
            dogId={DOG_ID}
            dogName={fx.model.dogName}
            hasSubscription={fx.hasSubscription ?? false}
            hideStart={fx.model.hideStart}
            onOpenAdjust={noop}
          />
        }
      />
      {fx.sheet && (
        <AdjustSheet
          open
          onClose={noop}
          formula={formula}
          dogId={DOG_ID}
          dogName={fx.model.dogName}
          onSaved={noop}
        />
      )}
    </>
  )
}
