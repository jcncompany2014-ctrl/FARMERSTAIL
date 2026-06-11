// B9 — 예방접종 기록 페이지 (app-only).
// 첫 진입 시 localStorage 기반 client 입력 + 다음 일정 자동 계산.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VaccinationsClient from './VaccinationsClient'

export default async function VaccinationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/vaccinations`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) redirect('/dogs')

  return (
    <div className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <div className="mt-3">
          <span className="kicker inline-block">Vaccinations</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            예방접종 기록
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            {dog.name as string}의 예방접종 일정과 기록을 한곳에서
          </p>
        </div>
      </div>
      <VaccinationsClient dogId={dogId} dogName={dog.name as string} />
    </div>
  )
}
