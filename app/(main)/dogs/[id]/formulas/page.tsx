// audit #101 — /dogs/[id]/formulas server component. interactivity 0 (timeline
// read-only). 이전 client 버전은 loading spinner + useEffect 한 번 후 render.
// 이제 server fetch + 즉시 페인트.
// 2026-10-09 앱 새 디자인('A 포스터') — 그리는 부분은 같은 폴더 FormulasView 로 옮겼다(조회·정렬·이동·하루 양
// 재계산은 여기 그대로). 점검 화면(/design-check/box)이 같은 FormulasView 에 예시 값을 넣어 시안과 나란히 본다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dailyGramsOf } from '@/lib/personalization/dailyGrams'
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

  const [{ data: dog }, { data: formulas }] = await Promise.all([
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
  ])

  if (!dog) {
    redirect('/dogs')
  }

  const dogName = (dog as { name: string }).name
  const rows = ((formulas ?? []) as unknown) as FormulaRow[]
  // 저장된 daily_grams 가 아니라 재계산(2026-08-03) — 그 칸은 만들 당시 kcal 밀도로
  // 굳어 있다. lib/personalization/dailyGrams 참조. (예전엔 카드 안에서 세던 것을 여기서 센다.)
  const viewRows: FormulaViewRow[] = rows.map(({ daily_grams, ...row }) => ({
    ...row,
    grams: dailyGramsOf(row) ?? daily_grams,
  }))

  return <FormulasView dogId={dogId} dogName={dogName} rows={viewRows} />
}
