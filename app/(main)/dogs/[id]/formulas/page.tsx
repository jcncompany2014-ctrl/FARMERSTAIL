// audit #101 — /dogs/[id]/formulas server component. interactivity 0 (timeline
// read-only). 이전 client 버전은 loading spinner + useEffect 한 번 후 render.
// 이제 server fetch + 즉시 페인트.
// 2026-10-09 앱 새 디자인('A 포스터') — 그리는 부분은 같은 폴더 FormulasView 로 옮겼다(조회·정렬·이동·하루 양
// 재계산은 여기 그대로). 점검 화면(/design-check/box)이 같은 FormulasView 에 예시 값을 넣어 시안과 나란히 본다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dailyGramsOf } from '@/lib/personalization/dailyGrams'
import { dailyPortionTotalG } from '@/lib/personalization/boxPricing'
import type { FoodLine } from '@/lib/personalization/types'
import FormulasView, { type FormulaViewRow } from './FormulasView'

type FormulaRow = Omit<FormulaViewRow, 'grams'> & { daily_grams: number }

export default async function FormulasHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dogs/${dogId}/formulas`)}`)
  }

  const [{ data: dog }, { data: formulas }, { data: subRows, error: subErr }] = await Promise.all([
    supabase
      .from('dogs')
      .select('name')
      .eq('id', dogId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('dog_formulas')
      .select(
        'id, cycle_number, approval_status, formula, reasoning, ' +
          'daily_kcal, daily_grams, applied_from, applied_until, ' +
          'user_adjusted, algorithm_version, created_at',
      )
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('cycle_number', { ascending: false }),
    // 화식 비율(30 곁들임 / 50 반반 / 100 완전) — 홈의 '오늘 화식'과 같은 계산을 하려고(2026-10-13 E5).
    supabase
      .from('subscriptions')
      .select('fresh_ratio, created_at')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (!dog) {
    redirect('/dogs')
  }

  const dogName = (dog as { name: string }).name
  const rows = ((formulas ?? []) as unknown) as FormulaRow[]
  // ★하루 g 는 **화식 비율을 곱한** 팩 규격의 합 — 홈 '오늘 화식'(dashboard dailyPortionTotalG)과 같은 계산(2026-10-13 E5).
  //   예전 dailyGramsOf 는 100% 화식 기준이라 곁들임(30%) 고객에게 실제 팩보다 3배 넘는 양을 '하루 g'로 보였다.
  //   구독이 없으면(또는 조회 실패면) 홈과 같이 완전 화식(100%) 기준.
  if (subErr) console.error('[dogs/formulas] 구독 조회 실패 — 화식 100% 기준으로 표시:', subErr.message)
  const freshRatio =
    (((subErr ? [] : subRows) ?? []) as Array<{ fresh_ratio: number | null }>)[0]?.fresh_ratio ?? 100
  const viewRows: FormulaViewRow[] = rows.map(({ daily_grams, ...row }) => {
    const ratios = row.formula?.lineRatios as Record<FoodLine, number> | undefined
    const portion =
      ratios && row.daily_kcal > 0 ? dailyPortionTotalG(ratios, row.daily_kcal, freshRatio) : 0
    // 저장된 daily_grams 는 만들 당시 kcal 밀도로 굳어 있다(2026-08-03) — 계산이 안 될 때만 마지막 대안.
    return { ...row, grams: portion > 0 ? portion : (dailyGramsOf(row) ?? daily_grams) }
  })

  return <FormulasView dogId={dogId} dogName={dogName} rows={viewRows} />
}
