'use client'

/**
 * 점검 화면 전용 — 결과 화면 둘러보기(components/v3/tour/ResultTour)를 원하는 단계로 띄운다(캔버스 TR0~TR4).
 * 실제 둘러보기는 이 폰 저장소(lib/result-tour)에 단계를 적고 화면을 건너 다니므로, 여기서 그 단계를 미리 적어 둔 뒤
 * 같은 부품을 붙인다. step='start' = 아직 안 본 상태에서 첫 결과 화면(시작 카드부터).
 */

import { useEffect, useState } from 'react'
import ResultTour from '@/components/v3/tour/ResultTour'
import { writeTour, type TourStep } from '@/lib/result-tour'

export default function TourDemo({ place, step, backHref }: { place: 'result' | 'home'; step: TourStep | 'start'; backHref: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      window.localStorage.removeItem('ft_result_tour_done')
      if (step === 'start') window.localStorage.removeItem('ft_result_tour')
      else writeTour({ step, dogName: '땅콩', backHref, startedAt: Date.now() })
    } catch {
      /* 저장소를 못 쓰면 둘러보기도 안 뜬다(실제와 같다) */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소를 먼저 적고 나서 붙인다
    setReady(true)
  }, [step, backHref])
  return ready ? <ResultTour place={place} dogName="땅콩" fromSurvey analysisCount={1} /> : null
}
