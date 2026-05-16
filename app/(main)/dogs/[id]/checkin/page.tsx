// audit #109 / #101 partial: checkin server wrapper — auth + dog 소유 검증.
// query (cycle/checkpoint) 파싱도 server 에서 — client useSearchParams 의존 제거.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckinClient from './CheckinClient'

type SearchParams = Promise<{ cycle?: string; checkpoint?: string }>

export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const { id } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${id}/checkin`)
  }

  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    redirect('/dogs')
  }

  const cycleNumber = Number(sp.cycle ?? '1') || 1
  const checkpoint: 'week_2' | 'week_4' =
    sp.checkpoint === 'week_4' ? 'week_4' : 'week_2'

  return (
    <CheckinClient
      dogId={id}
      cycleNumber={cycleNumber}
      checkpoint={checkpoint}
    />
  )
}
