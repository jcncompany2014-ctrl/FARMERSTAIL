import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AnalysesHistoryView, { type AnalysisHistoryRow } from './AnalysesHistoryView'

/**
 * /dogs/[id]/analyses — 분석 히스토리.
 * 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A06): 그리는 부분은 AnalysesHistoryView 로 옮겼다(조회·판정은 여기 그대로).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '분석 히스토리',
  robots: { index: false, follow: false },
}

/** 현재 알고리즘 출력 가이드라인 — 이 값보다 오래된 분석은 stale 표시. */
const CURRENT_GUIDELINE_VERSION =
  'NRC2006+AAFCO2024+FEDIAF2024+WSAVA2021+IRIS2019+KFA'

type Params = Promise<{ id: string }>

export default async function AnalysesTimelinePage({
  params,
}: {
  params: Params
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/analyses`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dog) notFound()

  const { data: analysesRaw } = await supabase
    .from('analyses')
    .select(
      'id, created_at, mer, rer, stage, bcs_label, bcs_score, feed_g, protein_pct, fat_pct, carb_pct, fiber_pct, guideline_version, vet_consult_recommended, next_review_date, commentary, supplements, source'
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    // 한 강아지에 분석이 100건+ 쌓이는 케이스는 거의 없지만 server-side
    // limit 으로 메모리 폭주 방어 (가드레일).
    .limit(50)

  const analyses = (analysesRaw ?? []) as Omit<AnalysisHistoryRow, 'isGrowthAuto'>[]
  // 자견은 매달 성장에 맞춰 자동으로 다시 계산된 기록도 쌓인다(source growth_auto, 2026-10-01) —
  // 설문 결과와 구분해 "매달 자동 갱신"으로 표시한다(규칙150).
  const rows: AnalysisHistoryRow[] = analyses.map((a) => ({
    ...a,
    isGrowthAuto: a.source === 'growth_auto',
  }))
  // v1.6.1 audit (2026-05-05) — algorithm 핵심 수정 후 분석은 stale 가능.
  // 첫 row (LATEST) 가 stale 면 "재분석 권장" hint.
  const latestIsStale =
    analyses.length > 0 &&
    analyses[0]!.guideline_version !== CURRENT_GUIDELINE_VERSION

  return <AnalysesHistoryView dogId={dogId} dogName={dog.name} analyses={rows} latestIsStale={latestIsStale} />
}
